import { buildPushPayload } from "@block65/webcrypto-web-push";

const API_PATH = "/api/push/";
const CALENDAR_PATH = "/calendar/chizumulu.ics";
const API_LIMIT = 100;
const MAX_REQUEST_BYTES = 16 * 1024;
const PUSH_TIMEOUT_MS = 15 * 1000;
const DELIVERY_LEASE_MS = 60 * 1000;
const DELIVERY_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const NOTIFICATION_TYPES = ["schedule", "reminder", "live", "result"];
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === CALENDAR_PATH) return serveLeagueCalendar(request, env);

    const origin = request.headers.get("Origin");
    if (!origin || origin !== env.SITE_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
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

      if (url.pathname === API_PATH + "subscriptions/status" && request.method === "POST") {
        return await subscriptionStatus(request, env, cors);
      }

      if (url.pathname === API_PATH + "subscriptions/preferences" && request.method === "POST") {
        return await subscriptionPreferences(request, env, cors);
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

async function readSubscription(request) {
  const value = await readJson(request);
  const subscription = value && value.subscription;
  const endpoint = subscription && subscription.endpoint;
  const keys = subscription && subscription.keys;

  if (typeof endpoint !== "string" || endpoint.length > 2048 || !isAllowedPushEndpoint(endpoint)) {
    return { error: "invalid_push_endpoint" };
  }
  if (!keys || !validPushKey(keys.p256dh, 60, 160) || !validPushKey(keys.auth, 16, 80)) {
    return { error: "invalid_push_keys" };
  }
  return { endpoint, keys, notificationTypes: value.notificationTypes };
}

function notificationPreferenceKey(id) {
  return "push_notification_types:" + id;
}

function parseNotificationTypes(types) {
  if (!Array.isArray(types) || types.length > NOTIFICATION_TYPES.length ||
      new Set(types).size !== types.length || types.some(type => !NOTIFICATION_TYPES.includes(type))) return null;
  return NOTIFICATION_TYPES.filter(type => types.includes(type));
}

function storedNotificationTypes(value) {
  if (typeof value !== "string") return NOTIFICATION_TYPES;
  try {
    return parseNotificationTypes(JSON.parse(value)) || NOTIFICATION_TYPES;
  } catch (_error) {
    return NOTIFICATION_TYPES;
  }
}

async function subscribe(request, env, cors) {
  const { endpoint, keys, notificationTypes, error } = await readSubscription(request);
  if (error) return json({ error }, 400, cors);
  const types = notificationTypes === undefined ? null : parseNotificationTypes(notificationTypes);
  if (notificationTypes !== undefined && types === null) return json({ error: "invalid_notification_types" }, 400, cors);

  const current = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").first();
  const id = await endpointId(endpoint);
  if (Number(current && current.count) >= 5000) {
    const existing = await env.DB.prepare("SELECT id FROM push_subscriptions WHERE id = ?").bind(id).first();
    if (!existing) return json({ error: "subscription_limit" }, 429, cors);
  }

  const now = new Date().toISOString();
  const insert = env.DB.prepare(
    "INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, " +
    "auth = excluded.auth, updated_at = excluded.updated_at"
  ).bind(id, endpoint, keys.p256dh, keys.auth, now, now);
  if (types === null) {
    await insert.run();
  } else {
    await env.DB.batch([
      insert,
      env.DB.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING")
        .bind(notificationPreferenceKey(id), JSON.stringify(types))
    ]);
  }

  return json({ ok: true }, 201, cors);
}

async function subscriptionStatus(request, env, cors) {
  const { endpoint, keys, error } = await readSubscription(request);
  if (error) return json({ error }, 400, cors);

  const id = await endpointId(endpoint);
  const subscription = await env.DB.prepare(
    "SELECT p.value FROM push_subscriptions AS s " +
    "LEFT JOIN app_settings AS p ON p.key = ? WHERE s.id = ? AND s.p256dh = ? AND s.auth = ?"
  ).bind(notificationPreferenceKey(id), id, keys.p256dh, keys.auth).first();
  const status = { registered: !!subscription };
  if (typeof subscription?.value === "string") status.notificationTypes = storedNotificationTypes(subscription.value);
  return json(status, 200, cors);
}

async function subscriptionPreferences(request, env, cors) {
  const { endpoint, keys, notificationTypes, error } = await readSubscription(request);
  if (error) return json({ error }, 400, cors);
  const id = await endpointId(endpoint);
  const key = notificationPreferenceKey(id);
  if (notificationTypes === undefined) {
    const subscription = await env.DB.prepare(
      "SELECT p.value FROM push_subscriptions AS s " +
      "LEFT JOIN app_settings AS p ON p.key = ? WHERE s.id = ? AND s.p256dh = ? AND s.auth = ?"
    ).bind(key, id, keys.p256dh, keys.auth).first();
    if (!subscription) return json({ error: "subscription_not_registered" }, 404, cors);
    return json({ notificationTypes: storedNotificationTypes(subscription.value) }, 200, cors);
  }
  const types = parseNotificationTypes(notificationTypes);
  if (types === null) return json({ error: "invalid_notification_types" }, 400, cors);
  const result = await env.DB.prepare(
    "INSERT INTO app_settings (key, value) " +
    "SELECT ?, ? FROM push_subscriptions WHERE id = ? AND p256dh = ? AND auth = ? " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, JSON.stringify(types), id, keys.p256dh, keys.auth).run();
  if (result.meta.changes !== 1) return json({ error: "subscription_not_registered" }, 404, cors);
  return json({ notificationTypes: types }, 200, cors);
}

async function removeSubscription(db, id, keys) {
  const remove = keys
    ? db.prepare("DELETE FROM push_subscriptions WHERE id = ? AND p256dh = ? AND auth = ?").bind(id, keys.p256dh, keys.auth)
    : db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(id);
  await db.batch([
    remove,
    db.prepare("DELETE FROM app_settings WHERE key = ? AND NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE id = ?)")
      .bind(notificationPreferenceKey(id), id)
  ]);
}

async function unsubscribe(request, env, cors) {
  const value = await readJson(request);
  const endpoint = value && value.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048) {
    return json({ error: "invalid_endpoint" }, 400, cors);
  }

  const id = await endpointId(endpoint);
  await removeSubscription(env.DB, id);
  return json({ ok: true }, 200, cors);
}

async function pollMatchesAndNotify(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing");

  const now = Date.now();
  await env.DB.prepare("DELETE FROM push_deliveries WHERE expires_at <= ?").bind(now).run();

  const subscriptions = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM push_subscriptions"
  ).first();
  if (!Number(subscriptions && subscriptions.count)) return;

  if (!env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID secrets are not configured");
  }

  try {
    await checkScheduleNotifications(env, now);
  } catch (error) {
    console.error("Schedule notification check failed:", error);
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
        const delivery = await broadcast(env, notification, {
          deliveryId: matchDeliveryId(null, match),
          createdBefore: Date.parse(match.lastSeenAt)
        });
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
      const delivery = await broadcast(env, notification, {
        deliveryId: matchDeliveryId(previous, match), createdBefore
      });
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
const SCHEDULE_CHANGE_RETRY_MS = 24 * 60 * 60 * 1000;

async function readPublishedSchedule(env) {
  const scheduleUrl = env.SCHEDULE_DATA_URL || "https://chizumulu.github.io/UTD/data.js";
  const response = await fetch(scheduleUrl, {
    headers: { "Accept": "text/javascript, text/plain;q=0.9, */*;q=0.8" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Schedule data returned HTTP " + response.status);

  const sourceModifiedAt = Date.parse(response.headers.get("Last-Modified") || "") || null;
  const source = (await response.text()).replace(/\r\n/g, "\n");
  const seasonStart = source.match(/\bconst SEASON_START\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const scheduled = readScheduleBlock(source, "scheduledRounds");
  if (scheduled === null) throw new Error("scheduledRounds block is missing or incomplete");
  const upcoming = readChizumuluFixtures(scheduled);
  return { source, seasonStart, sourceModifiedAt, upcoming };
}

function readLeagueFixtures(source, upcoming) {
  const results = readScheduleBlock(source, "roundsData");
  if (results === null) throw new Error("roundsData block is missing or incomplete");
  return mergeScheduleFixtures(upcoming, readChizumuluFixtures(results));
}

async function checkScheduleNotifications(env, now) {
  const { source, seasonStart, sourceModifiedAt, upcoming } = await readPublishedSchedule(env);
  const season = seasonStart?.slice(0, 4);

  if (season) {
    try {
      const fixtures = readLeagueFixtures(source, upcoming);
      await sendScheduleChanges(env, season, fixtures, now, sourceModifiedAt);
    } catch (error) {
      console.error("Schedule change check failed:", error);
    }
  }

  await sendKickoffReminders(env, season, upcoming, now);
}

async function serveLeagueCalendar(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  try {
    const { source, seasonStart, sourceModifiedAt, upcoming } = await readPublishedSchedule(env);
    const seasonStartAt = Date.parse(seasonStart || "");
    if (!Number.isFinite(seasonStartAt)) throw new Error("Schedule is missing a valid season start");
    const fixtures = readLeagueFixtures(source, upcoming);
    if (!fixtures.size) throw new Error("Schedule contains no Chizumulu fixtures");
    const body = buildLeagueCalendar(seasonStart.slice(0, 4), sourceModifiedAt ?? seasonStartAt, fixtures);
    const etag = '"' + await endpointId(body) + '"';
    const headers = {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="chizumulu.ics"',
      "Cache-Control": "public, max-age=300",
      ETag: etag
    };
    const tags = request.headers.get("If-None-Match")?.split(/\s*,\s*/) || [];
    if (tags.some(tag => tag === "*" || tag.replace(/^W\//, "") === etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(request.method === "HEAD" ? null : body, { headers });
  } catch (error) {
    console.error("League calendar could not be generated:", error);
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}

function calendarDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarText(value) {
  return value.replace(/\\/g, "\\\\").replace(/[;,]/g, "\\$&").replace(/\r\n|\r|\n/g, "\\n");
}

function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += length;
  }
  return result;
}

function buildLeagueCalendar(season, modifiedAt, fixtures) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chizumulu United FC Fan Site//NRFA//KO",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:치주물루 유나이티드 FC 리그 일정",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H"
  ];
  const dated = [...fixtures.values()].filter(fixture => fixture.kickoffAt !== null && fixture.status !== "undated")
    .sort((a, b) => a.kickoffAt - b.kickoffAt || a.homeEn.localeCompare(b.homeEn) || a.awayEn.localeCompare(b.awayEn));
  const stamp = calendarDate(modifiedAt);
  for (const fixture of dated) {
    const { homeEn, awayEn, homeKo, awayKo, kickoffAt, status } = fixture;
    const url = matchNotificationUrl(season, homeEn, awayEn);
    const cancelled = status === "postponed" || status === "cancelled";
    const label = status === "postponed" ? "[연기] " : status === "cancelled" ? "[취소] " : "";
    // Season and assigned home/away teams identify the match across changes to kickoff and round.
    const uid = "utd-" + [season, homeEn, awayEn].map(matchTeamSlug).join(".") + "@chizumulu.github.io";
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      "LAST-MODIFIED:" + stamp,
      "SEQUENCE:" + Math.floor(modifiedAt / 1000),
      "DTSTART:" + calendarDate(kickoffAt),
      "DTEND:" + calendarDate(kickoffAt + 2 * 60 * 60 * 1000),
      "STATUS:" + (cancelled ? "CANCELLED" : "CONFIRMED"),
      "SUMMARY:" + calendarText(label + homeKo + " vs " + awayKo),
      "URL:" + url,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}

async function sendKickoffReminders(env, season, fixtures, now) {
  for (const fixture of fixtures) {
    if (fixture.status !== "scheduled") continue;
    const { kickoffAt } = fixture;

    const notifyAt = kickoffAt - KICKOFF_REMINDER_LEAD_MS;
    if (now < notifyAt || now > notifyAt + KICKOFF_REMINDER_WINDOW_MS) continue;

    const pair = fixture.homeEn + "|" + fixture.awayEn;
    if (season) {
      const saved = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?")
        .bind(scheduleFixtureStateKey(season, pair)).first();
      if (saved) {
        const latest = JSON.parse(saved.value);
        if (latest.status !== "scheduled" || latest.kickoffAt !== kickoffAt) continue;
      }
    }
    const fixtureId = await endpointId(pair);
    const settingKey = "kickoff_reminder:" + fixtureId;
    const scheduledAt = new Date(kickoffAt).toISOString();
    const previous = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).bind(settingKey).first();
    if (previous && previous.value === scheduledAt) continue;

    const notification = {
      category: "reminder",
      title: "경기 시작 1시간 전이에요",
      body: fixture.homeKo + " vs " + fixture.awayKo + " · " + fixture.kickoffTime + " CAT 킥오프",
      icon: "/UTD/apple-touch-icon.png",
      tag: "utd-kickoff-" + fixtureId,
      renotify: false,
      data: { url: matchNotificationUrl(
        season, fixture.homeEn, fixture.awayEn, fixture.kickoffDate
      ) }
    };
    const delivery = await broadcast(env, notification, { deliveryId: settingKey + ":" + scheduledAt });
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

function readScheduleBlock(source, name) {
  const start = new RegExp("^const " + name + "\\s*=\\s*\\{", "m").exec(source);
  if (!start) return null;
  const end = source.indexOf("\n};", start.index + start[0].length);
  if (end < 0) return null;
  const block = source.slice(start.index + start[0].length, end);
  return /^const\s/m.test(block) ? null : block;
}

function readChizumuluFixtures(block) {
  const fixtures = [];
  // One object per fixture, including results whose properties span multiple lines.
  // Start at an indented object so examples inside line comments are ignored.
  for (const [item] of block.matchAll(/^[ \t]*\{[^{}]*\}(?=[ \t]*,?[ \t]*(?:\/\/[^\n]*)?$)/gm)) {
    const homeEn = quotedProperty(item, "homeEn");
    const awayEn = quotedProperty(item, "awayEn");
    if (homeEn !== "Chizumulu United FC" && awayEn !== "Chizumulu United FC") continue;
    if (/^\d+$/.test(fixtureProperty(item, "movedToWeek") || "")) continue;

    const kickoffDate = quotedProperty(item, "kickoffDate");
    const kickoffTime = quotedProperty(item, "kickoffTime");
    const homeKo = quotedProperty(item, "homeKo");
    const awayKo = quotedProperty(item, "awayKo");
    if (!homeKo || !awayKo) continue;

    const kickoff = parseCatKickoff(kickoffDate, kickoffTime);
    const kickoffAt = Number.isFinite(kickoff) ? kickoff : null;
    const completed = ["homeScore", "awayScore"].every(key => /^\d+$/.test(fixtureProperty(item, key) || ""));
    const status = completed ? "completed"
      : fixtureProperty(item, "cancelled") === "true" ? "cancelled"
      : fixtureProperty(item, "postponed") === "true" ? "postponed"
      : kickoffAt === null || fixtureProperty(item, "pendingResult") === "true" ? "undated"
      : "scheduled";
    fixtures.push({ homeEn, awayEn, homeKo, awayKo, kickoffDate, kickoffTime, kickoffAt, status });
  }
  return fixtures;
}

function quotedProperty(source, name) {
  const value = fixtureProperty(source, name);
  return value?.startsWith('"') ? JSON.parse(value) : "";
}

function fixtureProperty(source, name) {
  const expression = new RegExp('(?:^|[{,\\s])(?:"' + name + '"|' + name + ')\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|true\\b|false\\b|\\d+(?=\\s*[,}]))');
  return source.match(expression)?.[1];
}

function mergeScheduleFixtures(upcoming, results) {
  const priority = { undated: 0, postponed: 1, cancelled: 2, scheduled: 3, completed: 4 };
  const fixtures = new Map();
  for (const fixture of [...upcoming, ...results]) {
    const id = fixture.homeEn + "|" + fixture.awayEn;
    const existing = fixtures.get(id);
    if (!existing || priority[fixture.status] > priority[existing.status]) fixtures.set(id, fixture);
  }
  return fixtures;
}

function scheduleChangeType(previous, fixture, now) {
  if (fixture.status === "postponed" && previous.status === "scheduled" &&
      previous.kickoffAt + SCHEDULE_CHANGE_RETRY_MS > now) return "postponed";
  if (fixture.status !== "scheduled" || fixture.kickoffAt <= now) return null;
  if (previous.status === "postponed") return "rescheduled";
  if (previous.status === "scheduled" && previous.kickoffAt !== fixture.kickoffAt) return "changed";
  return null;
}

async function sendScheduleChanges(env, season, fixtures, now, sourceModifiedAt) {
  for (const [id, fixture] of fixtures) {
    const key = scheduleFixtureStateKey(season, id);
    const saved = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first();
    const previous = saved ? JSON.parse(saved.value) : null;
    if (previous && (previous.status === "completed" || now < previous.observedAt)) continue;
    if (sourceModifiedAt && previous?.sourceModifiedAt > sourceModifiedAt) continue;
    // Preserve a known time if the source is temporarily incomplete.
    if (previous && fixture.status === "undated") continue;

    let state = previous;
    let storedValue = saved?.value;
    if (!previous || previous.status !== fixture.status ||
        (fixture.status === "scheduled" && previous.kickoffAt !== fixture.kickoffAt)) {
      const type = previous ? scheduleChangeType(previous, fixture, now) : null;
      state = {
        status: fixture.status, kickoffAt: fixture.kickoffAt, observedAt: now,
        sourceModifiedAt: sourceModifiedAt || previous?.sourceModifiedAt || null,
        revision: (previous?.revision || 0) + 1,
        pending: type ? { type, previousKickoffAt: previous.kickoffAt } : null
      };
      const nextValue = JSON.stringify(state);
      const changed = previous
        ? await compareScheduleState(env.DB, key, storedValue, nextValue)
        : await env.DB.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING")
          .bind(key, nextValue).run();
      if (changed.meta.changes !== 1) continue;
      storedValue = nextValue;
    }
    if (!state.pending) continue;

    const tooLate = now - state.observedAt >= SCHEDULE_CHANGE_RETRY_MS ||
      (state.status === "scheduled" && state.kickoffAt <= now);
    if (!tooLate) {
      const delivery = await broadcast(env, scheduleChangeNotification(season, fixture, state), {
        deliveryId: key + ":" + state.revision, createdBefore: state.observedAt
      });
      if (delivery.transient > 0) continue;
    }
    await compareScheduleState(env.DB, key, storedValue, JSON.stringify({ ...state, pending: null }));
  }
}

function scheduleFixtureStateKey(season, id) {
  return "schedule_change:" + season + ":" + id;
}

function compareScheduleState(db, key, before, after) {
  return db.prepare("UPDATE app_settings SET value = ? WHERE key = ? AND value = ?")
    .bind(after, key, before).run();
}

function scheduleChangeNotification(season, fixture, state) {
  const { type, previousKickoffAt } = state.pending;
  const kickoff = ms => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
  const titles = {
    postponed: "경기가 연기됐어요",
    rescheduled: "연기 경기 새 일정이 나왔어요",
    changed: "경기 킥오프 일정이 바뀌었어요"
  };
  const timing = type === "postponed" ? "기존 " + kickoff(previousKickoffAt) + " KST · 새 일정 미정"
    : type === "rescheduled" ? "새 킥오프 " + kickoff(state.kickoffAt) + " KST"
    : kickoff(previousKickoffAt) + " → " + kickoff(state.kickoffAt) + " KST";
  return {
    category: "schedule",
    title: titles[type],
    body: fixture.homeKo + " vs " + fixture.awayKo + " · " + timing,
    icon: "/UTD/apple-touch-icon.png",
    tag: "utd-schedule-" + season + "-" + fixture.homeEn + "-" + fixture.awayEn,
    renotify: true,
    data: { url: matchNotificationUrl(season, fixture.homeEn, fixture.awayEn) }
  };
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

function matchDeliveryId(previous, match) {
  // Polls may update the minute or last-seen timestamp during a retry.
  const from = previous ? [previous.status, previous.home_score, previous.away_score] : null;
  return JSON.stringify(["match", match.matchId, from, match.status, match.homeScore, match.awayScore]);
}

function matchTeamSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function matchNotificationUrl(season, home, away, date) {
  const root = "https://chizumulu.github.io/UTD/";
  if (!home || !away || (!season && !date)) return root;
  const parts = season ? [season, matchTeamSlug(home), matchTeamSlug(away)] : ["live", home, away, date];
  return root + "#/match/" + parts.map(encodeURIComponent).join("/");
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
    category: type === "full_time" ? "result" : "live",
    title: title,
    body: body,
    icon: "/UTD/apple-touch-icon.png",
    tag: "utd-match-" + match.matchId,
    renotify: true,
    data: { url: matchNotificationUrl(null, match.homeTeam, match.awayTeam, match.lastSeenAt.slice(0, 10)) }
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
    const delivery = await broadcast(env, notification, { onlySubscriptionId: latest.id });
    if (delivery.success !== 1 || delivery.transient > 0 || delivery.permanent > 0) {
      return { ok: false, error: "delivery_failed", sentCount: index, failedStep: index + 1 };
    }
    if (index < steps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return { ok: true, sentCount: steps.length, target: "latest_subscription" };
}

async function claimDelivery(db, deliveryId, subscriptionId) {
  const now = Date.now();
  const leaseUntil = now + DELIVERY_LEASE_MS;
  const result = await db.prepare(
    "INSERT INTO push_deliveries (delivery_id, subscription_id, lease_until, expires_at) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(delivery_id, subscription_id) DO UPDATE SET " +
    "lease_until = excluded.lease_until, expires_at = excluded.expires_at " +
    "WHERE push_deliveries.delivered_at IS NULL AND push_deliveries.lease_until <= ?"
  ).bind(deliveryId, subscriptionId, leaseUntil, now + DELIVERY_RETENTION_MS, now).run();
  return result.meta.changes === 1 ? leaseUntil : null;
}

async function broadcast(env, notification, {
  deliveryId = null, createdBefore = null, onlySubscriptionId = null
} = {}) {
  const { category, ...payload } = notification;
  const result = await env.DB.prepare(
    "SELECT s.id, s.endpoint, s.p256dh, s.auth, s.created_at, d.delivered_at, p.value AS notification_types " +
    "FROM push_subscriptions AS s LEFT JOIN push_deliveries AS d " +
    "ON d.subscription_id = s.id AND d.delivery_id = ? " +
    "LEFT JOIN app_settings AS p ON p.key = 'push_notification_types:' || s.id"
  ).bind(deliveryId).all();
  const allSubscriptions = result && Array.isArray(result.results) ? result.results : [];
  const subscriptions = allSubscriptions.filter(row => {
    if (onlySubscriptionId !== null && row.id !== onlySubscriptionId) return false;
    if (category && !storedNotificationTypes(row.notification_types).includes(category)) return false;
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
    if (row.delivered_at !== null) continue;
    try {
      const leaseUntil = deliveryId === null ? null : await claimDelivery(env.DB, deliveryId, row.id);
      if (deliveryId !== null && leaseUntil === null) {
        // Another poll may still be sending this update.
        transient += 1;
        continue;
      }
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth }
      };
      const init = await buildPushPayload(
        { data: JSON.stringify(payload), options: { ttl: 900, urgency: "high" } },
        subscription,
        vapid
      );
      const response = await fetch(row.endpoint, { ...init, signal: AbortSignal.timeout(PUSH_TIMEOUT_MS) });
      if (response.status === 404 || response.status === 410) {
        await removeSubscription(env.DB, row.id, row);
        permanent += 1;
      } else if (response.ok) {
        if (deliveryId !== null) {
          const receipt = await env.DB.prepare(
            "UPDATE push_deliveries SET delivered_at = ? " +
            "WHERE delivery_id = ? AND subscription_id = ? AND lease_until = ?"
          ).bind(Date.now(), deliveryId, row.id, leaseUntil).run();
          if (receipt.meta.changes !== 1) throw new Error("Push delivery lease expired before storing the receipt");
        }
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
