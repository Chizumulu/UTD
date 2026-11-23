import { buildPushPayload } from "@block65/webcrypto-web-push";

const API_PATH = "/api/push/";
const API_LIMIT = 100;
const MAX_REQUEST_BYTES = 16 * 1024;
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com"
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== env.SITE_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === API_PATH + "test-sequence") {
        if (!env.PUSH_TEST_TOKEN) return json({ error: "test_not_configured" }, 503, cors);
        if (request.headers.get("Authorization") !== "Bearer " + env.PUSH_TEST_TOKEN) {
          return json({ error: "unauthorized" }, 401, cors);
        }
        const result = await sendTestSequenceToLatestSubscription(env);
        const status = result.ok ? 200 : (result.error === "no_subscription" ? 409 : 502);
        return json(result, status, cors);
      }

      if (request.method === "GET" && url.pathname === API_PATH + "config") {
        if (!env.VAPID_PUBLIC_KEY) return json({ error: "push_not_configured" }, 503, cors);
        return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, cors);
      }

      if (url.pathname === API_PATH + "subscriptions" && request.method === "POST") {
        return await subscribe(request, env, cors);
      }

      if (url.pathname === API_PATH + "subscriptions" && request.method === "DELETE") {
        return await unsubscribe(request, env, cors);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true }, 200, cors);
      }

      return json({ error: "not_found" }, 404, cors);
    } catch (error) {
      console.error("Push API request failed:", error);
      return json({ error: "internal_error" }, 500, cors);
    }
  },

  async scheduled(_controller, env, context) {
    context.waitUntil(pollMatchesAndNotify(env));
  }
};

function corsHeaders(origin) {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  });
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), { status: status, headers: headers });
}

async function readJson(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw new Error("request_too_large");
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) throw new Error("request_too_large");
  return JSON.parse(text);
}

function isAllowedPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_PUSH_HOSTS.some(function (domain) {
      return hostname === domain || hostname.endsWith("." + domain);
    });
  } catch (_error) {
    return false;
  }
}

function validPushKey(value, minLength, maxLength) {
  return typeof value === "string"
    && value.length >= minLength
    && value.length <= maxLength
    && /^[A-Za-z0-9_-]+$/.test(value);
}

async function endpointId(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function subscribe(request, env, cors) {
  const value = await readJson(request);
  const subscription = value && value.subscription;
  const endpoint = subscription && subscription.endpoint;
  const keys = subscription && subscription.keys;

  if (typeof endpoint !== "string" || endpoint.length > 2048 || !isAllowedPushEndpoint(endpoint)) {
    return json({ error: "invalid_push_endpoint" }, 400, cors);
  }
  if (!keys || !validPushKey(keys.p256dh, 60, 160) || !validPushKey(keys.auth, 16, 80)) {
    return json({ error: "invalid_push_keys" }, 400, cors);
  }

  const current = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").first();
  const id = await endpointId(endpoint);
  if (Number(current && current.count) >= 5000) {
    const existing = await env.DB.prepare("SELECT id FROM push_subscriptions WHERE id = ?").bind(id).first();
    if (!existing) return json({ error: "subscription_limit" }, 429, cors);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, " +
    "auth = excluded.auth, updated_at = excluded.updated_at"
  ).bind(id, endpoint, keys.p256dh, keys.auth, now, now).run();

  return json({ ok: true }, 201, cors);
}

async function unsubscribe(request, env, cors) {
  const value = await readJson(request);
  const endpoint = value && value.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048) {
    return json({ error: "invalid_endpoint" }, 400, cors);
  }

  const id = await endpointId(endpoint);
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(id).run();
  return json({ ok: true }, 200, cors);
}

async function pollMatchesAndNotify(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing");

  const subscriptions = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM push_subscriptions"
  ).first();
  if (!Number(subscriptions && subscriptions.count)) return;

  if (!env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID secrets are not configured");
  }

  const now = Date.now();
  try {
    await sendKickoffReminders(env, now);
  } catch (error) {
    console.error("Kickoff reminder check failed:", error);
  }

  const apiBase = env.MATCH_API_BASE || "https://api.chizumulu.net";
  const url = new URL("/v1/matches", apiBase);
  url.searchParams.set("teamId", env.TEAM_ID || "chizumulu_united");
  url.searchParams.set("competitionCode", env.COMPETITION_CODE || "nrfa_league_one");
  url.searchParams.set("limit", String(API_LIMIT));

  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Match API returned HTTP " + response.status);

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.matches)) {
    throw new Error("Match API response has no matches array");
  }

  const matches = payload.matches
    .filter(function (item) {
      return item && item.quality !== "conflict";
    })
    .map(normalizeMatch)
    .filter(function (match) {
      return match && isFresh(match, now);
    });

  const baseline = await env.DB.prepare(
    "SELECT value FROM app_settings WHERE key = ?"
  ).bind("baseline_complete").first();

  if (!baseline) {
    for (const match of matches) {
      // On the first poll, send only fresh final scores to devices that were
      // already subscribed when the API recorded the final update. This keeps
      // the historical baseline quiet for later subscribers.
      if (match.status === "full_time") {
        const notification = createNotification(null, match);
        const delivery = await broadcast(env, notification, Date.parse(match.lastSeenAt));
        if (delivery.targeted === 0) {
          console.log("Initial final score was not sent because no subscription predated the API update.", match.matchId);
        }
        if (delivery.transient > 0) {
          console.warn("Initial final score delivery failed temporarily; it will be retried.", match.matchId);
          continue;
        }
      }
      await saveMatchState(env.DB, match);
    }
    await env.DB.prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind("baseline_complete", "1").run();
    console.log("Initial match state stored; eligible fresh final scores were notified.");
    return;
  }

  for (const match of matches) {
    const previous = await env.DB.prepare(
      "SELECT * FROM match_states WHERE match_id = ?"
    ).bind(match.matchId).first();

    const firstSeenFinal = !previous && match.status === "full_time";
    const notification = createNotification(previous, match);
    if (notification) {
      const createdBefore = firstSeenFinal ? Date.parse(match.lastSeenAt) : null;
      const delivery = await broadcast(env, notification, createdBefore);
      if (firstSeenFinal && delivery.targeted === 0) {
        console.log("New final score was not sent because no subscription predated the API update.", match.matchId);
      }
      if (delivery.transient > 0) {
        console.warn("At least one push delivery failed temporarily; this match update will be retried.", match.matchId);
        continue;
      }
    }

    await saveMatchState(env.DB, match);
  }

  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM match_states WHERE updated_at < ?").bind(cutoff).run();
}

const KICKOFF_REMINDER_WINDOW_MS = 5 * 60 * 1000;
const KICKOFF_REMINDER_LEAD_MS = 60 * 60 * 1000;
const SCHEDULED_ROUNDS_MARKER = "const scheduledRounds = {";

async function sendKickoffReminders(env, now) {
  const scheduleUrl = env.SCHEDULE_DATA_URL || "https://chizumulu.github.io/UTD/data.js";
  const response = await fetch(scheduleUrl, {
    headers: { "Accept": "text/javascript, text/plain;q=0.9, */*;q=0.8" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Schedule data returned HTTP " + response.status);

  const fixtures = parseUpcomingChizumuluFixtures(await response.text());
  for (const fixture of fixtures) {
    const kickoffAt = parseCatKickoff(fixture.kickoffDate, fixture.kickoffTime);
    if (!Number.isFinite(kickoffAt)) continue;

    const notifyAt = kickoffAt - KICKOFF_REMINDER_LEAD_MS;
    if (now < notifyAt || now > notifyAt + KICKOFF_REMINDER_WINDOW_MS) continue;

    const fixtureId = await endpointId(fixture.homeEn + "|" + fixture.awayEn);
    const settingKey = "kickoff_reminder:" + fixtureId;
    const scheduledAt = new Date(kickoffAt).toISOString();
    const previous = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).bind(settingKey).first();
    if (previous && previous.value === scheduledAt) continue;

    const notification = {
      title: "경기 시작 1시간 전이에요",
      body: fixture.homeKo + " vs " + fixture.awayKo + " · " + fixture.kickoffTime + " CAT 킥오프",
      icon: "/UTD/apple-touch-icon.png",
      tag: "utd-kickoff-" + fixtureId,
      renotify: false,
      data: { url: "https://chizumulu.github.io/UTD/" }
    };
    const delivery = await broadcast(env, notification);
    if (delivery.transient > 0) {
      console.warn("Kickoff reminder delivery failed temporarily; it will be retried.", fixture.homeEn, fixture.awayEn);
      continue;
    }

    await env.DB.prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(settingKey, scheduledAt).run();
    console.log("Kickoff reminder sent.", fixture.homeEn, fixture.awayEn, scheduledAt);
  }
}

function parseUpcomingChizumuluFixtures(source) {
  const start = source.indexOf(SCHEDULED_ROUNDS_MARKER);
  if (start < 0) throw new Error("scheduledRounds was not found in data.js");
  const end = source.indexOf("\n};", start);
  if (end < 0) throw new Error("scheduledRounds block is incomplete");
  const block = source.slice(start, end);
  const fixtures = [];
  const objects = block.match(/\{[^{}\r\n]*\}/g) || [];

  for (const item of objects) {
    const homeEn = quotedProperty(item, "homeEn");
    const awayEn = quotedProperty(item, "awayEn");
    if (homeEn !== "Chizumulu United FC" && awayEn !== "Chizumulu United FC") continue;
    if (/\b(?:postponed|cancelled)\s*:\s*true\b/.test(item)) continue;
    if (/\bmovedToWeek\s*:/.test(item)) continue;
    if (/\b(?:homeScore|awayScore)\s*:/.test(item)) continue;

    const kickoffDate = quotedProperty(item, "kickoffDate");
    const kickoffTime = quotedProperty(item, "kickoffTime");
    const homeKo = quotedProperty(item, "homeKo");
    const awayKo = quotedProperty(item, "awayKo");
    if (!kickoffDate || !kickoffTime || !homeKo || !awayKo) continue;
    fixtures.push({ homeEn, awayEn, homeKo, awayKo, kickoffDate, kickoffTime });
  }
  return fixtures;
}

function quotedProperty(source, name) {
  const expression = new RegExp("(?:^|[,\\s])" + name + "\\s*:\\s*\"([^\"]*)\"");
  const match = source.match(expression);
  return match ? match[1] : "";
}

function parseCatKickoff(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  return Date.parse(date + "T" + time + ":00+02:00");
}

function normalizeMatch(item) {
  if (typeof item.matchId !== "string" || !item.matchId) return null;
  const homeTeam = item.homeTeam && item.homeTeam.name;
  const awayTeam = item.awayTeam && item.awayTeam.name;
  const score = item.score || {};
  return {
    matchId: item.matchId,
    homeTeam: typeof homeTeam === "string" ? homeTeam : "Home",
    awayTeam: typeof awayTeam === "string" ? awayTeam : "Away",
    homeScore: Number.isInteger(score.home) ? score.home : null,
    awayScore: Number.isInteger(score.away) ? score.away : null,
    status: typeof item.status === "string" ? item.status : "unknown",
    minuteText: typeof item.minuteText === "string" ? item.minuteText : "",
    lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : ""
  };
}

function isFresh(match, now) {
  const lastSeen = Date.parse(match.lastSeenAt);
  if (!Number.isFinite(lastSeen)) return false;
  const age = Math.max(0, now - lastSeen);
  const liveFreshness = 45 * 60 * 1000;
  const finalFreshness = 24 * 60 * 60 * 1000;

  if (match.status === "live" || match.status === "half_time") return age <= liveFreshness;
  if (match.status === "full_time") return age <= finalFreshness;
  return false;
}


function createNotification(previous, match) {
  const scoreChanged = !!previous && (
    (previous.home_score !== null && match.homeScore !== null && previous.home_score !== match.homeScore)
    || (previous.away_score !== null && match.awayScore !== null && previous.away_score !== match.awayScore)
  );

  if (!previous) {
    if (match.status === "full_time") return notificationPayload(match, "full_time");
    if (match.status !== "live" && match.status !== "half_time") return null;
    return notificationPayload(match, "start");
  }
  if (match.status === "full_time" && previous.status !== "full_time") {
    return notificationPayload(match, "full_time");
  }
  if (scoreChanged) return notificationPayload(match, "goal");
  if (previous.status !== match.status) {
    if (match.status === "half_time") return notificationPayload(match, "half_time");
    if (previous.status === "half_time" && match.status === "live") return notificationPayload(match, "second_half");
  }
  return null;
}

function notificationPayload(match, type) {
  const score = (match.homeScore === null ? "–" : match.homeScore)
    + "–"
    + (match.awayScore === null ? "–" : match.awayScore);
  const line = match.homeTeam + " " + score + " " + match.awayTeam;
  const minute = match.minuteText ? " · " + match.minuteText : "";
  let title;
  let body;

  if (type === "full_time") {
    title = "경기 종료 · " + score;
    body = line;
  } else if (type === "half_time") {
    title = "하프타임 · " + score;
    body = line;
  } else if (type === "second_half") {
    title = "후반전 시작 · " + score;
    body = line;
  } else if (type === "start") {
    title = "경기 시작 · " + score;
    body = line + minute;
  } else {
    title = "⚽ 득점 업데이트 · " + score;
    body = line + minute;
  }

  return {
    title: title,
    body: body,
    icon: "/UTD/apple-touch-icon.png",
    tag: "utd-match-" + match.matchId,
    renotify: true,
    data: { url: "https://chizumulu.github.io/UTD/" }
  };
}

async function sendTestSequenceToLatestSubscription(env) {
  const latest = await env.DB.prepare(
    "SELECT id FROM push_subscriptions ORDER BY created_at DESC LIMIT 1"
  ).first();
  if (!latest) return { ok: false, error: "no_subscription" };

  const steps = [
    { title: "테스트 경기 시작 · 0–0", body: "치주물루 유나이티드 vs 테스트 상대 · 킥오프" },
    { title: "⚽ 테스트 득점 · 0–1", body: "치주물루 유나이티드 0–1 테스트 상대" },
    { title: "⚽ 테스트 득점 · 0–2", body: "치주물루 유나이티드 0–2 테스트 상대" },
    { title: "⚽ 테스트 득점 · 1–2", body: "치주물루 유나이티드 1–2 테스트 상대" },
    { title: "테스트 경기 종료 · 1–2", body: "치주물루 유나이티드 1–2 테스트 상대 · 최종 스코어" }
  ];
  const sentAt = Date.now();

  for (let index = 0; index < steps.length; index += 1) {
    const notification = {
      title: steps[index].title,
      body: steps[index].body,
      icon: "/UTD/apple-touch-icon.png",
      tag: "utd-push-test-" + sentAt + "-" + index,
      renotify: false,
      data: { url: "https://chizumulu.github.io/UTD/" }
    };
    const delivery = await broadcast(env, notification, null, latest.id);
    if (delivery.success !== 1 || delivery.transient > 0 || delivery.permanent > 0) {
      return { ok: false, error: "delivery_failed", sentCount: index, failedStep: index + 1 };
    }
    if (index < steps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return { ok: true, sentCount: steps.length, target: "latest_subscription" };
}

async function broadcast(env, notification, createdBefore = null, onlySubscriptionId = null) {
  const result = await env.DB.prepare(
    "SELECT id, endpoint, p256dh, auth, created_at FROM push_subscriptions"
  ).all();
  const allSubscriptions = result && Array.isArray(result.results) ? result.results : [];
  const subscriptions = allSubscriptions.filter(row => {
    if (onlySubscriptionId !== null && row.id !== onlySubscriptionId) return false;
    if (createdBefore === null) return true;
    const createdAt = Date.parse(row.created_at);
    return Number.isFinite(createdAt) && createdAt <= createdBefore;
  });
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };
  let success = 0;
  let transient = 0;
  let permanent = 0;

  for (const row of subscriptions) {
    try {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth }
      };
      const init = await buildPushPayload(
        { data: JSON.stringify(notification), options: { ttl: 900, urgency: "high" } },
        subscription,
        vapid
      );
      const response = await fetch(row.endpoint, init);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
        permanent += 1;
      } else if (response.ok) {
        success += 1;
      } else {
        console.warn("Push service returned HTTP " + response.status);
        transient += 1;
      }
    } catch (error) {
      console.warn("Push delivery failed:", error);
      transient += 1;
    }
  }

  return { success: success, transient: transient, permanent: permanent, targeted: subscriptions.length };
}

async function saveMatchState(db, match) {
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO match_states (match_id, home_team, away_team, home_score, away_score, status, minute_text, last_seen_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(match_id) DO UPDATE SET home_team = excluded.home_team, away_team = excluded.away_team, " +
    "home_score = excluded.home_score, away_score = excluded.away_score, status = excluded.status, " +
    "minute_text = excluded.minute_text, last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at"
  ).bind(
    match.matchId,
    match.homeTeam,
    match.awayTeam,
    match.homeScore,
    match.awayScore,
    match.status,
    match.minuteText,
    match.lastSeenAt,
    now
  ).run();
}
