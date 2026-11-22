const API_URL = "https://api.chizumulu.net/v1/structured?limit=40";
const MAX_PROPOSAL_AGE_SECONDS = 60 * 60 * 24 * 14;
const FINISHED_STATUS = /^(full[_\s-]?time|ft|finished|final|ended|completed|match[_\s-]?ended)$/i;

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
    if (url.pathname === "/admin/resend" && request.method === "POST") {
      return runAuthorizedResend(request, env);
    }
    if (url.pathname === "/admin/resend") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
    }
    if (url.pathname === "/admin/scan" && request.method === "POST") {
      return runAuthorizedScan(request, env);
    }
    if (url.pathname === "/admin/scan") {
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

async function runAuthorizedScan(request, env) {
  const expectedToken = String(env.DIAGNOSTIC_TOKEN || "");
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!expectedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await scanForCompletedMatches(env);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || String(error) }, { status: 502 });
  }
}

async function runAuthorizedResend(request, env) {
  const expectedToken = String(env.DIAGNOSTIC_TOKEN || "");
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!expectedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Expected JSON with a matches array" }, { status: 400 });
  }
  if (!body || !Array.isArray(body.matches) || !body.matches.length || body.matches.length > 10) {
    return Response.json({ ok: false, error: "matches must contain 1 to 10 home/away/date entries" }, { status: 400 });
  }

  try {
    const recordedFixtures = await loadRecordedFixtures();
    const keys = [];
    let cursor;
    do {
      const page = await env.APPROVALS.list({ prefix: "match:", limit: 1000, cursor });
      keys.push(...(page.keys || []));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    const result = { ok: true, resentCount: 0, skippedCount: 0, results: [] };
    for (const requested of body.matches) {
      const requestedDate = normalizeMatchDate(requested?.date || "");
      if (!requestedDate) {
        result.skippedCount += 1;
        result.results.push({ home: requested?.home || "", away: requested?.away || "", status: "date_required" });
        continue;
      }
      const home = normalizeTeamIdentity(requested?.home || "");
      const away = normalizeTeamIdentity(requested?.away || "");
      if (!home || !away) {
        result.skippedCount += 1;
        result.results.push({ home: requested?.home || "", away: requested?.away || "", status: "invalid_match" });
        continue;
      }
      let proposal = null;
      let proposalId = "";
      for (const entry of keys) {
        const id = await env.APPROVALS.get(entry.name);
        if (!id) continue;
        const raw = await env.APPROVALS.get("proposal:" + id);
        if (!raw) continue;
        const candidate = JSON.parse(raw);
        if (normalizeTeamIdentity(candidate.home) === home &&
            normalizeTeamIdentity(candidate.away) === away) {
          proposal = candidate;
          proposalId = id;
          break;
        }
      }
      const resultItem = { home: requested.home, away: requested.away, date: requestedDate };
      if (!proposal) {
        result.skippedCount += 1;
        result.results.push({ ...resultItem, status: "not_found" });
        continue;
      }
      if (isRecordedFixture(recordedFixtures, requested.home, requested.away, requestedDate)) {
        result.skippedCount += 1;
        result.results.push({ ...resultItem, status: "already_in_data" });
        continue;
      }
      if (normalizeMatchDate(proposal.matchDate || "") !== requestedDate) {
        result.skippedCount += 1;
        result.results.push({ ...resultItem, status: "proposal_date_mismatch_or_missing", proposalId });
        continue;
      }
      const terminalStates = ["approved", "rejected", "dispatching", "superseded"];
      if (terminalStates.includes(String(proposal.state || "").toLowerCase())) {
        result.skippedCount += 1;
        result.results.push({ ...resultItem, status: "already_" + proposal.state, proposalId });
        continue;
      }
      try {
        await sendApprovalMessage(proposal, env, {
          confirmation: proposal.state === "awaiting_confirmation"
        });
        result.resentCount += 1;
        result.results.push({ ...resultItem, status: "resent", proposalId });
      } catch (error) {
        result.skippedCount += 1;
        result.results.push({ ...resultItem, status: "send_failed", proposalId, error: error.message || String(error) });
      }
    }
    console.log(JSON.stringify({ event: "whatsapp_approval_manual_resend", ...result }));
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ event: "whatsapp_approval_manual_resend_failed", error: error.message || String(error) }));
    return Response.json({ ok: false, error: error.message || String(error) }, { status: 502 });
  }
}

async function scanForCompletedMatches(env) {
  const summary = {
    checkedAt: new Date().toISOString(),
    itemCount: 0,
    matchCount: 0,
    recordedFixtureCount: 0,
    alreadyRecordedCount: 0,
    unverifiableDateCount: 0,
    terminalMatchCount: 0,
    proposalCount: 0,
    sentCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    incompleteCount: 0,
    nonStructuredItemCount: 0,
    statusCounts: {},
    terminalSamples: []
  };

  try {
    const response = await fetch(API_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Structured API returned " + response.status);
    const data = await response.json();
    const recordedFixtures = await loadRecordedFixtures();
    summary.recordedFixtureCount = recordedFixtures.length;
    const items = Array.isArray(data.items) ? data.items : [];
    summary.itemCount = items.length;

    const groups = new Map();
    let sequence = 0;
    for (const item of items) {
      const structured = item.structured;
      if (!structured || !Array.isArray(structured.matches)) {
        summary.nonStructuredItemCount += 1;
        continue;
      }
      for (const match of structured.matches) {
        sequence += 1;
        summary.matchCount += 1;
        const status = String(match?.status || "(missing)").trim();
        summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;

        const groupKey = matchSnapshotKey(item, match, sequence);
        let group = groups.get(groupKey);
        if (!group) {
          group = { snapshots: [], events: new Map() };
          groups.set(groupKey, group);
        }
        group.snapshots.push({
          item,
          match,
          timestamp: Date.parse(item.sourceTimestamp || ""),
          sequence
        });
        for (const event of Array.isArray(match.events) ? match.events : []) {
          if (event && typeof event === "object") {
            group.events.set(snapshotEventKey(event), {
              ...event,
              _snapshotHome: String(match.homeTeam || ""),
              _snapshotAway: String(match.awayTeam || ""),
              _sourceText: String(item.latestObservation?.text || "")
            });
          }
        }
      }
    }

    for (const group of groups.values()) {
      const terminalSnapshots = group.snapshots.filter(snapshot =>
        FINISHED_STATUS.test(String(snapshot.match.status || "").trim())
      );
      if (!terminalSnapshots.length) continue;
      summary.terminalMatchCount += 1;

      const candidate = terminalSnapshots.reduce((latest, snapshot) => {
        if (!latest) return snapshot;
        const currentTime = Number.isFinite(snapshot.timestamp) ? snapshot.timestamp : -Infinity;
        const latestTime = Number.isFinite(latest.timestamp) ? latest.timestamp : -Infinity;
        return currentTime > latestTime ||
          (currentTime === latestTime && snapshot.sequence > latest.sequence)
          ? snapshot
          : latest;
      }, null);

      const events = Array.from(group.events.values()).sort((a, b) => {
        const minuteA = Number.parseInt(a.minuteText || a.minute || "", 10);
        const minuteB = Number.parseInt(b.minuteText || b.minute || "", 10);
        return (Number.isFinite(minuteA) ? minuteA : Number.MAX_SAFE_INTEGER) -
          (Number.isFinite(minuteB) ? minuteB : Number.MAX_SAFE_INTEGER);
      });
      const mergedMatch = { ...candidate.match, events };
      const status = String(mergedMatch.status || "(missing)").trim();
      // The latest full-time snapshot may not be the post that contains the scorer list.
      // Search the terminal snapshots newest-first, while keeping the chosen match orientation/score.
      const terminalTexts = terminalSnapshots
        .filter(snapshot =>
          Number(snapshot.match.homeScore) === Number(candidate.match.homeScore) &&
          Number(snapshot.match.awayScore) === Number(candidate.match.awayScore)
        )
        .sort((a, b) => {
          const at = Number.isFinite(a.timestamp) ? a.timestamp : -Infinity;
          const bt = Number.isFinite(b.timestamp) ? b.timestamp : -Infinity;
          return bt - at || b.sequence - a.sequence;
        })
        .map(snapshot => String(snapshot.item.latestObservation?.text || snapshot.item.korean?.text || ""))
        .filter(Boolean);
      const terminalKoreanTexts = terminalSnapshots
        .filter(snapshot =>
          Number(snapshot.match.homeScore) === Number(candidate.match.homeScore) &&
          Number(snapshot.match.awayScore) === Number(candidate.match.awayScore)
        )
        .sort((a, b) => {
          const at = Number.isFinite(a.timestamp) ? a.timestamp : -Infinity;
          const bt = Number.isFinite(b.timestamp) ? b.timestamp : -Infinity;
          return bt - at || b.sequence - a.sequence;
        })
        .map(snapshot => String(snapshot.item.korean?.text || ""))
        .filter(Boolean);
      const proposalItem = {
        ...candidate.item,
        latestObservation: {
          ...(candidate.item.latestObservation || {}),
          text: terminalTexts.join("\n\n")
        },
        korean: {
          ...(candidate.item.korean || {}),
          text: terminalKoreanTexts.join("\n\n")
        }
      };
      const proposal = makeProposal(proposalItem, mergedMatch);

      if (summary.terminalSamples.length < 5) {
        summary.terminalSamples.push({
          status,
          homeTeam: String(mergedMatch.homeTeam || ""),
          awayTeam: String(mergedMatch.awayTeam || ""),
          homeScore: mergedMatch.homeScore ?? null,
          awayScore: mergedMatch.awayScore ?? null,
          eventCount: events.length,
          scorerSource: proposal?.scorerSource || null,
          recordedInData: Boolean(proposal?.matchDate && isRecordedFixture(recordedFixtures, proposal.home, proposal.away, proposal.matchDate)),
          scorers: proposal ? proposal.goals.map(goal => goal.name) : []
        });
      }
      if (!proposal) {
        summary.incompleteCount += 1;
        continue;
      }
      if (!proposal.matchDate) {
        summary.unverifiableDateCount += 1;
        continue;
      }
      if (isRecordedFixture(recordedFixtures, proposal.home, proposal.away, proposal.matchDate)) {
        summary.alreadyRecordedCount += 1;
        continue;
      }
      summary.proposalCount += 1;
      const key = "match:" + proposal.matchKey;
      const existingId = await env.APPROVALS.get(key);
      if (existingId) {
        summary.duplicateCount += 1;
        const proposalKey = "proposal:" + existingId;
        const existingRaw = await env.APPROVALS.get(proposalKey);
        if (existingRaw) {
          const existing = JSON.parse(existingRaw);
          const terminalStates = ["approved", "rejected", "dispatching"];
          const recent = Date.parse(existing.createdAt || "") >= Date.now() - 48 * 60 * 60 * 1000;
          if (!terminalStates.includes(existing.state) && recent &&
              approvalDetailsSignature(existing) !== approvalDetailsSignature(proposal)) {
            const updated = {
              ...existing,
              home: proposal.home,
              away: proposal.away,
              matchDate: proposal.matchDate,
              homeScore: proposal.homeScore,
              awayScore: proposal.awayScore,
              goals: proposal.goals,
              needsReview: proposal.needsReview,
              reviewWarnings: proposal.reviewWarnings
            };
            if (updated.state === "awaiting_confirmation" && !updated.needsReview) {
              delete updated.state;
            }
            await env.APPROVALS.put(proposalKey, JSON.stringify(updated), {
              expirationTtl: MAX_PROPOSAL_AGE_SECONDS
            });
            try {
              await sendApprovalMessage(updated, env, {
                confirmation: updated.state === "awaiting_confirmation"
              });
              summary.updatedCount += 1;
              console.log(JSON.stringify({
                event: "whatsapp_approval_details_updated",
                matchKey: proposal.matchKey,
                scorerCount: updated.goals.length,
                needsReview: updated.needsReview,
                proposalId: existingId
              }));
            } catch (error) {
              await env.APPROVALS.put(proposalKey, existingRaw, {
                expirationTtl: MAX_PROPOSAL_AGE_SECONDS
              });
              throw error;
            }
          }
        }
        continue;
      }

      const id = crypto.randomUUID();
      proposal.id = id;
      proposal.createdAt = new Date().toISOString();
      await env.APPROVALS.put("proposal:" + id, JSON.stringify(proposal), {
        expirationTtl: MAX_PROPOSAL_AGE_SECONDS
      });
      await env.APPROVALS.put(key, id, { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
      try {
        await sendApprovalMessage(proposal, env);
        summary.sentCount += 1;
        console.log(JSON.stringify({
          event: "whatsapp_approval_sent",
          matchKey: proposal.matchKey,
          score: proposal.homeScore + "-" + proposal.awayScore,
          scorerCount: proposal.goals.length,
          proposalId: id
        }));
      } catch (error) {
        await env.APPROVALS.delete("proposal:" + id);
        await env.APPROVALS.delete(key);
        console.error(JSON.stringify({
          event: "whatsapp_approval_send_failed",
          matchKey: proposal.matchKey,
          error: error.message || String(error)
        }));
        throw error;
      }
    }

    console.log(JSON.stringify({ event: "scorer_scan_summary", ...summary }));
    return summary;
  } catch (error) {
    console.error(JSON.stringify({
      event: "scorer_scan_failed",
      checkedAt: summary.checkedAt,
      itemCount: summary.itemCount,
      matchCount: summary.matchCount,
      error: error.message || String(error)
    }));
    throw error;
  }
}

function matchSnapshotKey(item, match, sequence) {
  const stableId = String(match.matchId || match.match_id || match.fixtureId || match.id || "").trim();
  if (stableId) return "id:" + normalize(stableId);

  const home = normalizeTeamIdentity(match.homeTeam);
  const away = normalizeTeamIdentity(match.awayTeam);
  const dateSource = String(match.dateText || item.sourceTimestamp || "").trim();
  const dayFirst = dateSource.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  let day = "";
  if (dayFirst) {
    day = dayFirst[3] + "-" + dayFirst[2].padStart(2, "0") + "-" + dayFirst[1].padStart(2, "0");
  } else {
    const parsed = Date.parse(dateSource);
    day = Number.isFinite(parsed)
      ? new Date(parsed).toISOString().slice(0, 10)
      : String(item.sourceTimestamp || "").slice(0, 10);
  }
  if (!home || !away || !day) {
    return "snapshot:" + String(item.rawUpdateId || item.sourceMessageId || sequence);
  }
  // API posts can reverse the displayed home/away order for the same fixture.
  // Group by an unordered pair; makeProposal keeps the latest final snapshot's orientation.
  return [home, away].sort().join("|") + "|" + day;
}

function normalizeTeamIdentity(value) {
  const team = normalize(value)
    .replace(/\b(?:fc|sc|afc|club|football)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (team === "chibavi rs") return "chibavi real stars";
  return team;
}

function snapshotEventKey(event) {
  const players = (Array.isArray(event.players) ? event.players : [])
    .map(player => [
      normalize(player?.name || ""),
      normalize(player?.role || ""),
      String(player?.count ?? ""),
      Boolean(player?.ownGoal || player?.isOwnGoal)
    ].join(":"))
    .sort()
    .join(",");
  return [
    String(event.type || "").toLowerCase(),
    normalize(event.team || ""),
    String(event.minuteText || event.minute || ""),
    players
  ].join("|");
}

function approvalDetailsSignature(proposal) {
  return JSON.stringify({
    home: proposal.home || "",
    away: proposal.away || "",
    matchDate: proposal.matchDate || "",
    homeScore: proposal.homeScore ?? null,
    awayScore: proposal.awayScore ?? null,
    goals: proposal.goals || [],
    needsReview: Boolean(proposal.needsReview),
    reviewWarnings: proposal.reviewWarnings || []
  });
}

function parseResultTextScorers(text, home, away, homeScore, awayScore) {
  if (!text) return null;
  const clean = String(text)
    .replace(/(\d)\uFE0F?\u20E3/g, "$1")
    .replace(/\\?\*/g, "");
  const lines = clean.split(/\r?\n/);
  const matchLine = /^\s*(.+?)\s+(\d+)\s*[-–:]\s*(\d+)\s+(.+?)\s*$/;
  let names = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+@.*$/, "").trim();
    const match = line.match(matchLine);
    if (!match) continue;
    if (normalizeTeamIdentity(match[1]) !== normalizeTeamIdentity(home) ||
        normalizeTeamIdentity(match[4]) !== normalizeTeamIdentity(away) ||
        Number(match[2]) !== homeScore || Number(match[3]) !== awayScore) continue;

    const following = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#") || matchLine.test(next)) break;
      following.push(next.replace(/[()\[\]]/g, ""));
    }
    names = following.join(",");
    break;
  }
  if (names == null) return null;

  // This API result omitted punctuation between two Raiply scorers:
  // "Jasan Zimba Limbani Kamanga". Preserve the two known names rather than
  // treating the full string as one scorer.
  names = names.replace(/\b(Jasan\s+Zimba)\s+(Limbani\s+Kamanga)\b/i, "$1, $2");

  const parsed = [];
  for (const raw of names.split(/[,;]+/)) {
    let token = raw.trim().replace(/^[-\s]+|[-\s]+$/g, "");
    if (!token) continue;
    let count = 1;
    const suffix = token.match(/\s*(?:[×xX]\s*(\d+)|\((\d+)\s*(?:goals?|골)?\))\s*$/i);
    if (suffix) {
      count = Number(suffix[1] || suffix[2]);
      token = token.slice(0, suffix.index).trim();
    } else if (/\bbrace\b/i.test(token)) {
      count = 2;
      token = token.replace(/\bbrace\b/ig, "").trim();
    } else if (/\bhat[ -]?trick\b/i.test(token)) {
      count = 3;
      token = token.replace(/\bhat[ -]?trick\b/ig, "").trim();
    }
    if (!/[A-Za-z]{2}/.test(token) || !Number.isInteger(count) || count < 1 || count > 9) continue;
    parsed.push({ name: token, count, ownGoal: false });
  }
  if (!parsed.length) return null;

  const expectedTotal = homeScore + awayScore;
  const listedTotal = parsed.reduce((sum, scorer) => sum + scorer.count, 0);
  // Do not infer a brace from the team score alone. If the source list is incomplete,
  // use structured goal events instead; any remaining score mismatch stays reviewable.
  if (listedTotal !== expectedTotal) return null;

  let homeRemaining = homeScore;
  const assigned = [];
  for (const scorer of parsed) {
    if (homeRemaining > 0 && scorer.count <= homeRemaining) {
      assigned.push({ side: "home", ...scorer });
      homeRemaining -= scorer.count;
    } else if (homeRemaining === 0) {
      assigned.push({ side: "away", ...scorer });
    } else {
      // A multi-goal entry crossing the home/away score boundary needs roster data.
      return null;
    }
  }
  const assignedHome = assigned.filter(goal => goal.side === "home").reduce((sum, goal) => sum + goal.count, 0);
  const assignedAway = assigned.filter(goal => goal.side === "away").reduce((sum, goal) => sum + goal.count, 0);
  return assignedHome === homeScore && assignedAway === awayScore ? assigned : null;
}

function parseKoreanResultScorers(text, matchIndex, homeScore, awayScore) {
  if (!text) return null;
  const clean = String(text)
    .replace(/(\d)\uFE0F?\u20E3/g, "$1")
    .replace(/\\?\*/g, "");
  const lines = clean.split(/\r?\n/);
  const scoreLine = /^\s*(.+?)\s+(\d+)\s*[-–:]\s*(\d+)\s+(.+?)\s*$/;
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(scoreLine);
    if (!match || !/[가-힣]/.test(match[1]) || !/[가-힣]/.test(match[4])) continue;
    rows.push({ lineIndex: i, homeScore: Number(match[2]), awayScore: Number(match[3]) });
  }
  let row = Number.isInteger(matchIndex) ? rows[matchIndex] : null;
  if (!row || row.homeScore !== homeScore || row.awayScore !== awayScore) {
    const candidates = rows.filter(item =>
      item.homeScore === homeScore && item.awayScore === awayScore
    );
    if (candidates.length !== 1) return null;
    row = candidates[0];
  }

  const scorerLines = [];
  for (let i = row.lineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || scoreLine.test(line)) break;
    scorerLines.push(line.replace(/[()\[\]]/g, ""));
  }
  const parsed = [];
  for (const raw of scorerLines.join(",").split(/[,;]+/)) {
    let name = raw.trim().replace(/^[-\s]+|[-\s]+$/g, "");
    if (!name) continue;
    let count = 1;
    const suffix = name.match(/\s*(?:[×xX]\s*(\d+)|\((\d+)\s*골?\))\s*$/i);
    if (suffix) {
      count = Number(suffix[1] || suffix[2]);
      name = name.slice(0, suffix.index).trim();
    } else if (/\b해트트릭\b/.test(name)) {
      count = 3;
      name = name.replace(/\b해트트릭\b/g, "").trim();
    } else if (/\b두\s*골\b/.test(name)) {
      count = 2;
      name = name.replace(/\b두\s*골\b/g, "").trim();
    }
    if (!/[가-힣]/.test(name) || !Number.isInteger(count) || count < 1 || count > 9) continue;
    parsed.push({ name, count });
  }
  return parsed.length ? parsed : null;
}

function normalizeMatchDate(value) {
  const text = String(value || "").trim();
  const dayFirst = text.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (dayFirst) {
    return dayFirst[3] + "-" + dayFirst[2].padStart(2, "0") + "-" + dayFirst[1].padStart(2, "0");
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

async function loadRecordedFixtures() {
  const response = await fetch("https://raw.githubusercontent.com/Chizumulu/UTD/main/data.js", {
    headers: { accept: "text/plain" }
  });
  if (!response.ok) throw new Error("Could not load data.js (" + response.status + "); refusing to send approval messages");
  const source = await response.text();
  const start = source.indexOf("const roundsData = {");
  const end = start >= 0 ? source.indexOf("\n};", start) : -1;
  if (start < 0 || end < 0) throw new Error("Could not parse roundsData from data.js; refusing to send approval messages");
  const region = source.slice(start, end);
  const fixtures = [];
  for (const objectMatch of region.matchAll(/\{[^{}]*\}/g)) {
    const row = objectMatch[0];
    const home = row.match(/\bhomeEn\s*:\s*"([^"]+)"/)?.[1] || "";
    const away = row.match(/\bawayEn\s*:\s*"([^"]+)"/)?.[1] || "";
    const date = row.match(/\bkickoffDate\s*:\s*"([^"]+)"/)?.[1] || "";
    const homeScore = row.match(/\bhomeScore\s*:\s*(\d+)\b/);
    const awayScore = row.match(/\bawayScore\s*:\s*(\d+)\b/);
    if (home && away && date && homeScore && awayScore) {
      fixtures.push({ home, away, date: normalizeMatchDate(date) });
    }
  }
  if (!fixtures.length) throw new Error("No completed fixtures parsed from data.js; refusing to send approval messages");
  return fixtures;
}

function isRecordedFixture(fixtures, home, away, date) {
  const wantedDate = normalizeMatchDate(date);
  const wantedTeams = [normalizeTeamIdentity(home), normalizeTeamIdentity(away)].sort().join("|");
  if (!wantedDate || !wantedTeams.replace(/\|/g, "")) return false;
  return fixtures.some(fixture =>
    fixture.date === wantedDate &&
    [normalizeTeamIdentity(fixture.home), normalizeTeamIdentity(fixture.away)].sort().join("|") === wantedTeams
  );
}

function makeProposal(item, match) {
  if (!match || !FINISHED_STATUS.test(String(match.status || "").trim())) return null;
  const home = String(match.homeTeam || "").trim();
  const away = String(match.awayTeam || "").trim();
  if (match.homeScore == null || match.awayScore == null) return null;
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (!home || !away || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) return null;

  const goals = [];
  const reviewWarnings = [];
  const quality = String(match.quality || match.dataQuality || "").trim().toLowerCase();
  const hasConflict =
    match.conflict === true ||
    match.hasConflict === true ||
    (Array.isArray(match.conflicts) && match.conflicts.length > 0) ||
    ["conflict", "conflicted", "needs_review", "review"].includes(quality);
  if (hasConflict) {
    reviewWarnings.push("API가 경기 데이터 충돌 또는 검토 필요 상태로 표시함");
  }
  const textGoals = parseResultTextScorers(
    item.latestObservation?.text || item.korean?.text || "",
    home,
    away,
    homeScore,
    awayScore
  );
  if (textGoals) {
    goals.push(...textGoals);
  } else {
    const seenGoals = new Map();
    for (const event of match.events || []) {
      const eventType = String(event.type || "").toLowerCase();
      const players = Array.isArray(event.players) ? event.players.filter(Boolean) : [];
      const explicitScorers = players.filter(player =>
        /scorer|own[ _-]?goal/i.test(String(player.role || "")) ||
        player.ownGoal === true || player.isOwnGoal === true
      );
      const isGoalEvent = /^(goal|penalt|own)/i.test(eventType) || explicitScorers.length > 0;
      if (!isGoalEvent) continue;
  
      if (eventType.startsWith("penalt")) {
        const outcome = normalize(event.outcome || event.result || event.status || "");
        const confirmedScorer = explicitScorers.length > 0;
        if (!confirmedScorer && !/goal|scor|convert|successful/.test(outcome)) {
          reviewWarnings.push("페널티 이벤트의 득점 여부 확인 필요");
          continue;
        }
      }
  
      // Match the live card: scorer roles win; otherwise a goal event contributes its first
      // non-assist player. Do not count every participant in an event as a scorer.
      let scorerPlayers = explicitScorers.length
        ? explicitScorers
        : players.filter(player => !/assist/i.test(String(player.role || ""))).slice(0, 1);
      if (!scorerPlayers.length) {
        reviewWarnings.push("득점 이벤트에 득점자 정보가 없음");
        continue;
      }
  
      let side = teamSide(event.team, home, away);
      if (!side && (event._side === "home" || event._side === "away")) {
        side = event._side;
        const sourceHome = normalizeTeamIdentity(event._snapshotHome || "");
        const sourceAway = normalizeTeamIdentity(event._snapshotAway || "");
        if (sourceHome && sourceAway &&
            sourceHome === normalizeTeamIdentity(away) &&
            sourceAway === normalizeTeamIdentity(home)) {
          side = side === "home" ? "away" : "home";
        }
      }
      if (!side) {
        reviewWarnings.push("득점 이벤트의 팀을 확인할 수 없음");
        continue;
      }
  
      for (const player of scorerPlayers) {
        const name = String(player.name || "").replace(/\s*[×xX]\s*\d+\s*$/, "").trim();
        const inlineCount = String(player.name || "").match(/[×xX]\s*(\d+)\s*$/);
        const count = Math.max(Number(player.count || 1), inlineCount ? Number(inlineCount[1]) : 1);
        if (!name || !Number.isInteger(count) || count < 1 || count > 9) {
          reviewWarnings.push("득점자 이름 또는 득점 횟수가 올바르지 않음");
          continue;
        }
        const minute = String(event.minuteText || event.minute || "").trim();
        const minuteMatch = minute.match(/(\d+)\s*(?:\+\s*(\d+))?/);
        const minuteKey = minuteMatch
          ? (minuteMatch[2] ? minuteMatch[1] + "+" + minuteMatch[2] : minuteMatch[1])
          : minute;
        const ownGoal = Boolean(player.ownGoal || player.isOwnGoal ||
          /own[ _-]?goal/i.test(String(player.role || "")) || event.ownGoal);
        const normalizedName = normalizeScorerName(name);
        const duplicate = Array.from(seenGoals.values()).find(goal =>
          goal.side === side && goal.minuteKey === minuteKey &&
          similarScorerNames(normalizeScorerName(goal.name), normalizedName)
        );
        if (duplicate) {
          duplicate.count = Math.max(duplicate.count, count);
          duplicate.ownGoal = duplicate.ownGoal || ownGoal;
        } else {
          const goal = { side, name, count, minute, minuteKey, ownGoal };
          seenGoals.set(seenGoals.size, goal);
        }
      }
    }
    goals.push(...seenGoals.values());
    for (const goal of goals) {
      delete goal.minuteKey;
    }
  
  
  }

  const translatedNames = parseKoreanResultScorers(
    item.korean?.text || "",
    Number.isInteger(match.index) ? match.index : null,
    homeScore,
    awayScore
  );
  if (translatedNames && translatedNames.length === goals.length &&
      translatedNames.every((translated, index) => translated.count === goals[index].count)) {
    goals.forEach((goal, index) => { goal.nameKo = translatedNames[index].name; });
  }

  const homeCount = goals.filter(g => g.side === "home").reduce((n, g) => n + g.count, 0);
  const awayCount = goals.filter(g => g.side === "away").reduce((n, g) => n + g.count, 0);
  if (homeCount !== homeScore || awayCount !== awayScore) {
    reviewWarnings.push("득점자 합계 " + homeCount + "-" + awayCount + "가 최종 점수 " + homeScore + "-" + awayScore + "와 다름");
  }

  const matchDate = normalizeMatchDate(match.dateText || "");
  const sourceId = String(item.rawUpdateId || item.sourceMessageId || "");
  const stableMatchId = String(match.matchId || match.match_id || match.fixtureId || match.id || "").trim();
  const dateSource = String(match.dateText || item.sourceTimestamp || "");
  const parsedDate = Date.parse(dateSource);
  const matchDay = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString().slice(0, 10) : dateSource.slice(0, 10);
  if (!stableMatchId && !match.dateText) {
    reviewWarnings.push("경기 고유 ID와 경기 날짜가 없어 경기 식별 확인 필요");
  }
  const matchKey = stableMatchId
    ? "id:" + stableMatchId.toLowerCase()
    : normalize(home) + "|" + normalize(away) + "|" + matchDay;
  return {
    sourceId,
    matchKey,
    matchDate,
    home,
    away,
    homeScore,
    awayScore,
    goals,
    scorerSource: textGoals ? "result_text" : "structured_events",
    needsReview: reviewWarnings.length > 0,
    reviewWarnings,
    sourceText: String(item.latestObservation?.text || "").slice(0, 1800)
  };
}

function normalizeScorerName(value) {
  return String(value || "").toLowerCase().replace(/[×x]\s*\d+\s*$/i, "")
    .replace(/[^a-z]/g, "").replace(/h/g, "");
}

function scorerEditDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

function similarScorerNames(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const min = Math.min(a.length, b.length), max = Math.max(a.length, b.length);
  if (min < 5) return false;
  const tolerance = max >= 14 ? 4 : max >= 10 ? 3 : max >= 7 ? 2 : 1;
  return max - min <= tolerance && scorerEditDistance(a, b) <= tolerance;
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
  return normalizeTeamIdentity(value).split(" ").filter(Boolean);
}

function normalize(value) {
  return String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function sendApprovalMessage(proposal, env, { confirmation = false } = {}) {
  const base = env.WHATSAPP_GRAPH_URL;
  if (!base || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN ||
      !env.WHATSAPP_ADMIN_WA_ID || !env.WHATSAPP_TEMPLATE_NAME) {
    throw new Error("WhatsApp settings are incomplete");
  }
  const homeScorers = formatScorersForMessage(proposal.goals, "home");
  const awayScorers = formatScorersForMessage(proposal.goals, "away");
  const actions = confirmation ? ["confirm", "hold", "reject"] : ["approve", "hold", "reject"];
  const buttons = await Promise.all(
    actions.map(async (action, index) => ({
      type: "button",
      sub_type: "quick_reply",
      index: String(index),
      parameters: [{ type: "payload", payload: await signedPayload(proposal.id, action, env) }]
    }))
  );
  const matchText = proposal.home + " " + proposal.homeScore + "–" + proposal.awayScore + " " + proposal.away;
  const reviewText = proposal.needsReview
    ? "⚠️ 확인 필요: " + proposal.reviewWarnings.join(" / ") + "\n"
    : "";
  const confirmationText = confirmation
    ? "⚠️ 2차 확인: 아래 승인 버튼을 다시 눌러야 GitHub 반영이 진행됩니다.\n"
    : "";
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
              { type: "text", text: sanitizeTemplateText(confirmationText + reviewText + matchText) },
              { type: "text", text: sanitizeTemplateText(homeScorers.slice(0, 900)) },
              { type: "text", text: sanitizeTemplateText(awayScorers.slice(0, 900)) },
              { type: "text", text: sanitizeTemplateText(proposal.id) }
            ]
          },
          ...buttons
        ]
      }
    })
  });
  if (!response.ok) throw new Error("WhatsApp send failed: " + response.status + " " + (await response.text()).slice(0, 500));
}

function sanitizeTemplateText(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function formatScorersForMessage(goals, side) {
  const byPlayer = new Map();
  for (const goal of goals.filter(item => item.side === side)) {
    const name = String(goal.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase() + "|" + Boolean(goal.ownGoal);
    const current = byPlayer.get(key) || {
      name,
      nameKo: String(goal.nameKo || "").trim(),
      count: 0,
      ownGoal: Boolean(goal.ownGoal)
    };
    if (!current.nameKo && goal.nameKo) current.nameKo = String(goal.nameKo).trim();
    current.count += Number(goal.count || 1);
    byPlayer.set(key, current);
  }
  return Array.from(byPlayer.values(), player => {
    const suffix = player.count > 1 ? " " + player.count + "골" : " 1골";
    const bilingualName = player.nameKo
      ? player.name + " (" + player.nameKo + ")"
      : player.name;
    return bilingualName + suffix + (player.ownGoal ? " (자책골)" : "");
  }).join("\n") || "없음";
}

async function handleAction(payload, env) {
  const match = String(payload).match(/^(approve|confirm|reject|hold):([0-9a-f-]{36}):([0-9a-f]{64})$/i);
  if (!match) return;
  const [, action, id, signature] = match;
  const selected = action.toLowerCase();
  if (!constantTimeEqual(signature, await sign(id + ":" + selected, env.APPROVAL_SIGNING_SECRET || ""))) return;

  const key = "proposal:" + id;
  const raw = await env.APPROVALS.get(key);
  if (!raw) return;
  const proposal = JSON.parse(raw);
  if (["approved", "rejected", "dispatching"].includes(proposal.state)) return;

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

  if (selected === "confirm") {
    if (!proposal.needsReview || proposal.state !== "awaiting_confirmation") return;
  } else if (selected === "approve") {
    if (proposal.needsReview) {
      if (proposal.state === "awaiting_confirmation") return;
      if (proposal.state && proposal.state !== "held") return;

      const priorState = proposal.state;
      proposal.state = "awaiting_confirmation";
      proposal.confirmationRequestedAt = new Date().toISOString();
      await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
      try {
        await sendApprovalMessage(proposal, env, { confirmation: true });
      } catch (error) {
        if (priorState) proposal.state = priorState;
        else delete proposal.state;
        delete proposal.confirmationRequestedAt;
        await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
        throw error;
      }
      return;
    }
    if (proposal.state && proposal.state !== "held") return;
  } else {
    return;
  }

  const [owner, repository] = String(env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repository || !env.GITHUB_TOKEN) throw new Error("GitHub dispatch settings are incomplete");

  const priorState = proposal.state;
  proposal.state = "dispatching";
  await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
  const approvedProposal = { ...proposal, state: "approved", approvedAt: new Date().toISOString() };
  let response;
  try {
    response = await fetch("https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repository) + "/dispatches", {
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
        client_payload: { proposal: approvedProposal }
      })
    });
  } catch (error) {
    proposal.state = priorState;
    await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
    throw error;
  }
  if (!response.ok) {
    proposal.state = priorState;
    await env.APPROVALS.put(key, JSON.stringify(proposal), { expirationTtl: MAX_PROPOSAL_AGE_SECONDS });
    throw new Error("GitHub dispatch failed: " + response.status + " " + (await response.text()).slice(0, 500));
  }
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
