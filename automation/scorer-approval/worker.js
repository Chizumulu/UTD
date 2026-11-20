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
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(scanForCompletedMatches(env));
  }
};

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
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (!home || !away || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;

  const goals = [];
  for (const event of match.events || []) {
    if (String(event.type || "").toLowerCase() !== "goal") continue;
    const side = teamSide(event.team, home, away);
    if (!side) return null;
    const players = (event.players || []).filter(p => p && !/assist/i.test(String(p.role || "")));
    if (!players.length) return null;
    for (const player of players) {
      const name = String(player.name || "").trim();
      const count = Number(player.count || 1);
      if (!name || !Number.isInteger(count) || count < 1 || count > 10) return null;
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
  // Incomplete or conflicting event data must never become an approval proposal.
  if (homeCount !== homeScore || awayCount !== awayScore) return null;

  const sourceId = String(item.rawUpdateId || item.sourceMessageId || "");
  const matchKey = normalize(home) + "|" + normalize(away) + "|" +
    String(match.dateText || item.sourceTimestamp || "").slice(0, 10);
  return {
    sourceId,
    matchKey,
    home,
    away,
    homeScore,
    awayScore,
    goals,
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
  const summary = proposal.goals.map(g => {
    const suffix = g.count > 1 ? " x" + g.count : "";
    return (g.side === "home" ? "H" : "A") + " " + g.name + suffix;
  }).join(", ");
  const buttons = ["approve", "reject", "hold"].map((action, index) => ({
    type: "button",
    sub_type: "quick_reply",
    index: String(index),
    parameters: [{ type: "payload", payload: await signedPayload(proposal.id, action, env) }]
  }));
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
        language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: proposal.home + " " + proposal.homeScore + "–" + proposal.awayScore + " " + proposal.away },
              { type: "text", text: summary.slice(0, 900) || "Scorer details" },
              { type: "text", text: proposal.id.slice(0, 8) }
            ]
          },
          ...buttons
        ]
      }
    })
  });
  if (!response.ok) throw new Error("WhatsApp send failed: " + response.status + " " + (await response.text()).slice(0, 500));
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

  const response = await fetch("https://api.github.com/repos/" + encodeURIComponent(env.GITHUB_REPOSITORY) + "/dispatches", {
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
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(signature, b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyMetaSignature(raw, supplied, secret) {
  const expected = "sha256=" + await sign(raw, secret);
  return constantTimeEqual(supplied, expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
