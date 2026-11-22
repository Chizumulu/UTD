const API_URL = "https://api.chizumulu.net/v1/structured?limit=40";
const MAX_PROPOSAL_AGE_SECONDS = 60 * 60 * 24 * 14;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/webhook" && request.method === "GET") {
      return verifyWebhook(url, env);
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      return receiveWebhook(request, env);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/admin/diagnostics" && request.method === "POST") {
      return runDiagnostics(request, env);
    }
    if (url.pathname === "/admin/diagnostics") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(scanForCompletedMatches(env));
  }
};

async function runDiagnostics(request, env) {
  const expectedToken = String(env.DIAGNOSTIC_TOKEN || "");
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!expectedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object");
  } catch {
    return Response.json({ ok: false, error: "Send a JSON object with sendTest set to true or false" }, { status: 400 });
  }

  const sendTest = body.sendTest === true;
  const base = String(env.WHATSAPP_GRAPH_URL || "").replace(/\/$/, "");
  const phoneId = String(env.WHATSAPP_PHONE_NUMBER_ID || "");
  const wabaId = String(env.WHATSAPP_BUSINESS_ACCOUNT_ID || "");
  const templateName = String(env.WHATSAPP_TEMPLATE_NAME || "");
  const language = String(env.WHATSAPP_TEMPLATE_LANGUAGE || "ko");
  const token = String(env.WHATSAPP_ACCESS_TOKEN || "");
  const recipient = String(env.WHATSAPP_ADMIN_WA_ID || "");
  const result = {
    checkedAt: new Date().toISOString(),
    sendTestRequested: sendTest,
    checks: {
      configuration: {
        ok: Boolean(base && phoneId && wabaId && templateName && language && token),
        graphUrlConfigured: Boolean(base),
        accessTokenConfigured: Boolean(token),
        phoneNumberIdConfigured: Boolean(phoneId),
        businessAccountIdConfigured: Boolean(wabaId),
        templateNameConfigured: Boolean(templateName),
        templateLanguageConfigured: Boolean(language),
        testRecipientConfigured: Boolean(recipient)
      },
      accessToken: { ok: false, skipped: true },
      phoneNumber: { ok: false, skipped: true },
      template: { ok: false, skipped: true },
      testMessage: { requested: sendTest, ok: null, skipped: !sendTest }
    }
  };

  let graphUrl;
  try {
    graphUrl = new URL(base);
    if (graphUrl.protocol !== "https:" || graphUrl.hostname !== "graph.facebook.com") {
      throw new Error("WHATSAPP_GRAPH_URL must use https://graph.facebook.com/<version>");
    }
  } catch (error) {
    result.checks.configuration.ok = false;
    result.checks.configuration.error = error.message;
  }

  if (result.checks.configuration.ok && graphUrl) {
    const phoneResult = await callMeta(
      base + "/" + encodeURIComponent(phoneId) + "?fields=id,display_phone_number,verified_name",
      token
    );
    result.checks.accessToken = metaCheck(phoneResult);
    result.checks.phoneNumber = {
      ...metaCheck(phoneResult),
      idMatches: String(phoneResult.body?.id || "") === phoneId,
      displayPhoneNumber: phoneResult.body?.display_phone_number || null,
      verifiedName: phoneResult.body?.verified_name || null
    };
    result.checks.phoneNumber.ok = result.checks.phoneNumber.ok && result.checks.phoneNumber.idMatches;

    const templateUrl = new URL(base + "/" + encodeURIComponent(wabaId) + "/message_templates");
    templateUrl.searchParams.set("name", templateName);
    templateUrl.searchParams.set("fields", "name,status,language,quality_score,components");
    templateUrl.searchParams.set("limit", "100");
    const templateResult = await callMeta(templateUrl.toString(), token);
    const candidates = Array.isArray(templateResult.body?.data) ? templateResult.body.data : [];
    const template = candidates.find(item =>
      item && item.name === templateName && item.language === language
    ) || null;
    const templateStatus = String(template?.status || "").toUpperCase();
    const templateComponents = Array.isArray(template?.components) ? template.components : [];
    const templateBody = templateComponents.find(component =>
      String(component.type || "").toUpperCase() === "BODY"
    );
    const bodyNumbers = Array.from(String(templateBody?.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g), m => Number(m[1]));
    const bodyVariablesOk = bodyNumbers.length === 4 &&
      [1, 2, 3, 4].every(number => bodyNumbers.includes(number));
    const buttonComponent = templateComponents.find(component =>
      String(component.type || "").toUpperCase() === "BUTTONS"
    );
    const buttonTitles = (buttonComponent?.buttons || []).map(button => String(button.text || "").trim());
    const normalizeButton = value => {
      const text = value.toLowerCase();
      if (text === "승인" || text === "approve") return "approve";
      if (text === "보류" || text === "hold") return "hold";
      if (text === "거절" || text === "reject") return "reject";
      return text;
    };
    const expectedButtons = ["approve", "hold", "reject"];
    const buttonOrderOk = buttonTitles.length === 3 &&
      buttonTitles.map(normalizeButton).every((value, index) => value === expectedButtons[index]);
    result.checks.template = {
      ...metaCheck(templateResult),
      found: Boolean(template),
      name: template?.name || templateName,
      language: template?.language || language,
      status: template?.status || null,
      qualityScore: template?.quality_score || null,
      bodyVariableNumbers: bodyNumbers,
      bodyVariablesOk,
      buttonTitles,
      buttonOrderOk,
      ok: Boolean(templateResult.ok && template && ["APPROVED", "ACTIVE"].includes(templateStatus) &&
        bodyVariablesOk && buttonOrderOk)
    };
    result.checks.template.error = templateResult.body?.error
      ? metaError(templateResult.body.error)
      : (!template ? { message: "Matching template name/language not found" } : null);
  } else {
    const skippedReason = result.checks.configuration.error || "Required Worker secrets are missing";
    result.checks.accessToken = { ok: false, skipped: true, reason: skippedReason };
    result.checks.phoneNumber = { ok: false, skipped: true, reason: skippedReason };
    result.checks.template = { ok: false, skipped: true, reason: skippedReason };
  }

  if (sendTest) {
    const prerequisitesOk = result.checks.accessToken.ok &&
      result.checks.phoneNumber.ok && result.checks.template.ok && Boolean(recipient);
    if (!prerequisitesOk) {
      result.checks.testMessage = {
        requested: true,
        ok: false,
        skipped: true,
        reason: recipient ? "Meta token, phone number, or approved template check failed" : "WHATSAPP_ADMIN_WA_ID is not configured"
      };
    } else {
      const testResult = await sendDiagnosticMessage(base, phoneId, token, recipient, templateName, language);
      result.checks.testMessage = {
        requested: true,
        ...metaCheck(testResult),
        response: testResult.body?.messages
          ? { messageIds: testResult.body.messages.map(message => message.id).filter(Boolean) }
          : null
      };
    }
  }

  const checkResults = [result.checks.accessToken, result.checks.phoneNumber, result.checks.template];
  result.ok = checkResults.every(check => check.ok) &&
    (!sendTest || result.checks.testMessage.ok === true);
  const logEntry = {
    event: "whatsapp_diagnostic",
    checkedAt: result.checkedAt,
    ok: result.ok,
    sendTestRequested: sendTest,
    checks: {
      accessToken: logCheck(result.checks.accessToken),
      phoneNumber: logCheck(result.checks.phoneNumber),
      template: logCheck(result.checks.template),
      testMessage: logCheck(result.checks.testMessage)
    }
  };
  console.log(JSON.stringify(logEntry));
  try {
    await env.APPROVALS.put("diagnostic:last", JSON.stringify(logEntry), { expirationTtl: 60 * 60 * 24 * 7 });
  } catch (error) {
    console.error(JSON.stringify({ event: "whatsapp_diagnostic_storage_error", message: error.message }));
    result.logStorageError = error.message;
  }
  return Response.json(result, { status: result.ok ? 200 : 502 });
}

async function callMeta(url, token) {
  let response;
  let body = null;
  try {
    response = await fetch(url, {
      headers: { authorization: "Bearer " + token, accept: "application/json" }
    });
    const raw = await response.text();
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { body = { nonJsonResponse: raw.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: null, body: { transportError: error.message } };
  }
}

function metaError(error) {
  if (!error) return null;
  return {
    code: error.code ?? null,
    subcode: error.error_subcode ?? null,
    type: error.type || null,
    message: String(error.message || "").slice(0, 500),
    fbtraceId: error.fbtrace_id || null
  };
}

function metaCheck(response) {
  const error = response.body?.error || null;
  return {
    ok: Boolean(response.ok && !error),
    httpStatus: response.status,
    error: metaError(error),
    transportError: response.body?.transportError || null
  };
}

function logCheck(check) {
  return {
    ok: check?.ok ?? false,
    skipped: check?.skipped ?? false,
    httpStatus: check?.httpStatus ?? null,
    error: check?.error || null,
    idMatches: check?.idMatches ?? null,
    found: check?.found ?? null,
    status: check?.status ?? null,
    bodyVariablesOk: check?.bodyVariablesOk ?? null,
    buttonOrderOk: check?.buttonOrderOk ?? null,
    requested: check?.requested ?? null
  };
}

async function sendDiagnosticMessage(base, phoneId, token, recipient, templateName, language) {
  const url = base + "/" + encodeURIComponent(phoneId) + "/messages";
  return callMetaPost(url, token, {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "진단 테스트 - 실제 경기 데이터와 무관" },
            { type: "text", text: "테스트 홈팀 득점자" },
            { type: "text", text: "테스트 원정팀 득점자" },
            { type: "text", text: "DIAGNOSTIC-ONLY" }
          ]
        },
        ...["0", "1", "2"].map(index => ({
          type: "button",
          sub_type: "quick_reply",
          index,
          parameters: [{ type: "payload", payload: "diagnostic_test" }]
        }))
      ]
    }
  });
}

async function callMetaPost(url, token, body) {
  let response;
  let parsed = null;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    try { parsed = raw ? JSON.parse(raw) : {}; }
    catch { parsed = { nonJsonResponse: raw.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    return { ok: false, status: null, body: { transportError: error.message } };
  }
}

function verifyWebhook(url, env) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && constantTimeEqual(token, env.META_VERIFY_TOKEN || "")) {
    return new Response(challenge || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

async function receiveWebhook(request, env) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!(await verifyMetaSignature(raw, signature, env.META_APP_SECRET || ""))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const messages = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) messages.push(message);
    }
  }

  for (const message of messages) {
    const sender = String(message.from || "");
    if (!constantTimeEqual(sender, env.WHATSAPP_ADMIN_WA_ID || "")) continue;
    const payload = message.button?.payload || message.interactive?.button_reply?.id || "";
    await handleAction(payload, env);
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}

async function scanForCompletedMatches(env) {
  const response = await fetch(API_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Structured API returned " + response.status);
  const data = await response.json();

  for (const item of data.items || []) {
    const structured = item.structured;
    if (!structured || !Array.isArray(structured.matches)) continue;
    for (const match of structured.matches) {
      const proposal = makeProposal(item, match);
      if (!proposal) continue;

      const key = "match:" + proposal.matchKey;
      if (await env.APPROVALS.get(key)) continue;
      const id = crypto.randomUUID();
      proposal.id = id;
      proposal.createdAt = new Date().toISOString();
      await env.APPROVALS.put("proposal:" + id, JSON.stringify(proposal), {
        expirationTtl: MAX_PROPOSAL_AGE_SECONDS
      });
      await env.APPROVALS.put(key, id, { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
      try {
        await sendApprovalMessage(proposal, env);
      } catch (error) {
        await env.APPROVALS.delete("proposal:" + id);
        await env.APPROVALS.delete(key);
        throw error;
      }
    }
  }
}

function makeProposal(item, match) {
  if (!match || !["full_time", "finished", "ended"].includes(String(match.status || "").toLowerCase())) return null;
  const home = String(match.homeTeam || "").trim();
  const away = String(match.awayTeam || "").trim();
  if (match.homeScore == null || match.awayScore == null) return null;
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (!home || !away || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;

  const goals = [];
  const reviewWarnings = [];
  for (const event of match.events || []) {
    const eventType = String(event.type || "").toLowerCase();
    const players = (event.players || []).filter(p => p && !/assist/i.test(String(p.role || "")));
    if (eventType === "penalty") {
      const outcome = normalize(event.outcome || event.result || event.status || "");
      const confirmedScorer = players.some(p => /scorer/i.test(String(p.role || "")));
      if (!confirmedScorer && !/goal|scor|convert|successful/.test(outcome)) {
        reviewWarnings.push("페널티 이벤트의 득점 여부 확인 필요");
        continue;
      }
    } else if (eventType !== "goal") {
      continue;
    }

    const side = teamSide(event.team, home, away);
    if (!side) {
      reviewWarnings.push("득점 이벤트의 팀을 확인할 수 없음");
      continue;
    }
    if (!players.length) {
      reviewWarnings.push("득점 이벤트에 득점자 정보가 없음");
      continue;
    }
    for (const player of players) {
      const name = String(player.name || "").trim();
      const count = Number(player.count ?? 1);
      if (!name || !Number.isInteger(count) || count < 1 || count > 10) {
        reviewWarnings.push("득점자 이름 또는 득점 횟수가 올바르지 않음");
        continue;
      }
      goals.push({
        side,
        name,
        count,
        minute: String(event.minuteText || event.minute || "").trim(),
        ownGoal: Boolean(player.ownGoal || player.isOwnGoal || event.ownGoal)
      });
    }
  }

  const homeCount = goals.filter(g => g.side === "home").reduce((n, g) => n + g.count, 0);
  const awayCount = goals.filter(g => g.side === "away").reduce((n, g) => n + g.count, 0);
  if (homeCount !== homeScore || awayCount !== awayScore) {
    reviewWarnings.push("득점자 합계 " + homeCount + "-" + awayCount + "가 최종 점수 " + homeScore + "-" + awayScore + "와 다름");
  }

  const sourceId = String(item.rawUpdateId || item.sourceMessageId || "");
  const dateSource = String(match.dateText || item.sourceTimestamp || "");
  const parsedDate = Date.parse(dateSource);
  const matchDay = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString().slice(0, 10) : dateSource.slice(0, 10);
  const matchKey = normalize(home) + "|" + normalize(away) + "|" + matchDay;
  return {
    sourceId,
    matchKey,
    home,
    away,
    homeScore,
    awayScore,
    goals,
    needsReview: reviewWarnings.length > 0,
    reviewWarnings,
    sourceText: String(item.latestObservation?.text || "").slice(0, 1800)
  };
}

function teamSide(value, home, away) {
  const candidate = teamTokens(value);
  const h = teamTokens(home);
  const a = teamTokens(away);
  if (!candidate.length) return null;
  const hm = candidate.every(t => h.includes(t)) || h.every(t => candidate.includes(t));
  const am = candidate.every(t => a.includes(t)) || a.every(t => candidate.includes(t));
  if (hm === am) return null;
  return hm ? "home" : "away";
}

function teamTokens(value) {
  return normalize(value).split(" ").filter(t => t && !["fc", "sc", "afc", "club", "football"].includes(t));
}

function normalize(value) {
  return String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function sendApprovalMessage(proposal, env) {
  const base = env.WHATSAPP_GRAPH_URL;
  if (!base || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN ||
      !env.WHATSAPP_ADMIN_WA_ID || !env.WHATSAPP_TEMPLATE_NAME) {
    throw new Error("WhatsApp settings are incomplete");
  }
  const homeScorers = formatScorersForMessage(proposal.goals, "home");
  const awayScorers = formatScorersForMessage(proposal.goals, "away");
  // Keep this order aligned with the Meta template buttons: 승인, 보류, 거절.
  const buttons = await Promise.all(
    ["approve", "hold", "reject"].map(async (action, index) => ({
      type: "button",
      sub_type: "quick_reply",
      index: String(index),
      parameters: [{ type: "payload", payload: await signedPayload(proposal.id, action, env) }]
    }))
  );
  const response = await fetch(base.replace(/\/$/, "") + "/" +
    encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID) + "/messages", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.WHATSAPP_ACCESS_TOKEN,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: env.WHATSAPP_ADMIN_WA_ID,
      type: "template",
      template: {
        name: env.WHATSAPP_TEMPLATE_NAME,
        language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || "ko" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: (proposal.needsReview ? "⚠️ 확인 필요: " + proposal.reviewWarnings.join(" / ") + "\n" : "") + proposal.home + " " + proposal.homeScore + "–" + proposal.awayScore + " " + proposal.away },
              { type: "text", text: homeScorers.slice(0, 900) },
              { type: "text", text: awayScorers.slice(0, 900) },
              { type: "text", text: proposal.id }
            ]
          },
          ...buttons
        ]
      }
    })
  });
  if (!response.ok) throw new Error("WhatsApp send failed: " + response.status + " " + (await response.text()).slice(0, 500));
}

function formatScorersForMessage(goals, side) {
  const byPlayer = new Map();
  for (const goal of goals.filter(item => item.side === side)) {
    const name = String(goal.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase() + "|" + Boolean(goal.ownGoal);
    const current = byPlayer.get(key) || { name, count: 0, ownGoal: Boolean(goal.ownGoal) };
    current.count += Number(goal.count || 1);
    byPlayer.set(key, current);
  }
  return Array.from(byPlayer.values(), player => {
    const suffix = player.count > 1 ? " " + player.count + "골" : " 1골";
    return player.name + suffix + (player.ownGoal ? " (자책골)" : "");
  }).join("\n") || "없음";
}

async function handleAction(payload, env) {
  const match = String(payload).match(/^(approve|reject|hold):([0-9a-f-]{36}):([0-9a-f]{64})$/i);
  if (!match) return;
  const [, action, id, signature] = match;
  if (!constantTimeEqual(signature, await sign(id + ":" + action.toLowerCase(), env.APPROVAL_SIGNING_SECRET || ""))) return;

  const key = "proposal:" + id;
  const raw = await env.APPROVALS.get(key);
  if (!raw) return;
  const proposal = JSON.parse(raw);
  if (proposal.state && proposal.state !== "held") return;

  const selected = action.toLowerCase();
  if (selected === "hold") {
    proposal.state = "held";
    proposal.lastActionAt = new Date().toISOString();
    await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
    return;
  }
  if (selected === "reject") {
    proposal.state = "rejected";
    proposal.lastActionAt = new Date().toISOString();
    await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
    return;
  }

  const [owner, repository] = String(env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repository || !env.GITHUB_TOKEN) throw new Error("GitHub dispatch settings are incomplete");
  const response = await fetch("https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repository) + "/dispatches", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.GITHUB_TOKEN,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "utd-scorer-approval"
    },
    body: JSON.stringify({
      event_type: "scorer-proposal-approved",
      client_payload: { proposal }
    })
  });
  if (!response.ok) throw new Error("GitHub dispatch failed: " + response.status + " " + (await response.text()).slice(0, 500));
  proposal.state = "approved";
  proposal.lastActionAt = new Date().toISOString();
  await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
}

async function signedPayload(id, action, env) {
  return action + ":" + id + ":" + await sign(id + ":" + action, env.APPROVAL_SIGNING_SECRET || "");
}

async function sign(value, secret) {
  if (!secret || secret.length < 32) throw new Error("Signing secret must be at least 32 characters");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(signature, b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyMetaSignature(raw, supplied, secret) {
  if (!secret || !supplied) return false;
  const expected = "sha256=" + await sign(raw, secret);
  return constantTimeEqual(supplied, expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
