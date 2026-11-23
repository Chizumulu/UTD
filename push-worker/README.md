# UTD self-hosted Web Push

This Worker polls the public Chizumulu API and sends Web Push notifications when a Chizumulu United match starts, its score changes, reaches half time, or finishes. It does not rely on OneSignal or an open PWA page.

## Deploy

Use a Cloudflare account with Workers and D1 enabled.

1. From this directory, run `npm install`.
2. Create the database: `npx wrangler d1 create utd-match-push`.
3. Copy the returned database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
4. Apply the schema: `npx wrangler d1 execute utd-match-push --remote --file=./schema.sql`.
5. Generate VAPID keys with `npx web-push generate-vapid-keys --json`.
6. Add the returned public and private keys, plus a contact subject, as Worker secrets:
   - `npx wrangler secret put VAPID_PUBLIC_KEY`
   - `npx wrangler secret put VAPID_PRIVATE_KEY`
   - `npx wrangler secret put VAPID_SUBJECT` (for example, `mailto:maintainer@example.org`)
7. Deploy: `npx wrangler deploy`.
8. Copy the deployed Worker URL into `window.UTD_PUSH_API_URL` in the repository root file `push-config.js`, without a trailing slash.
9. Publish the site changes to GitHub Pages.

The Worker accepts browser requests only from `https://chizumulu.github.io`. Keep the VAPID private key in Cloudflare Worker secrets; never put it in the PWA or GitHub repository.

For an existing deployment upgrading to delivery receipts, apply the updated schema to the existing D1 database with `npm run db:apply`, then deploy the Worker before publishing the updated site. The site uses the Worker's subscription status endpoint to confirm that the current browser subscription is registered.

## Polling and notifications

The Cron Trigger runs every two minutes. Change the expression in `wrangler.jsonc` to adjust the frequency. The Worker checks up to 100 recent matches for `teamId=chizumulu_united` and `competitionCode=nrfa_league_one`, ignores stale live rows older than 45 minutes, and skips notifications for the first poll so existing results do not generate a burst of alerts. It also reads `scheduledRounds` from the public site `data.js` and sends a one-hour kickoff reminder for unplayed Chizumulu fixtures with a date and time. The schedule strings use Malawi local time (Central Africa Time, UTC+02:00), as used by the site and its calendar downloads. Some fixture times in `data.js` are explicitly marked as provisional 15:00 defaults, so reminders use those values until the schedule is corrected.

Push subscriptions are stored in D1. Expired subscriptions that return HTTP 404 or 410 are removed automatically. The notification card is tagged by match so later score updates replace the prior card where the platform supports it.

Each device can choose schedule changes, one-hour reminders, live updates, and final scores. Existing registrations without saved preferences receive every type. An empty selection pauses all match alerts while keeping the registration. The preferences endpoint verifies the device's existing subscription keys and saves its choices in `app_settings`.

The Worker also reads `scheduledRounds` and `roundsData` to detect changes to Chizumulu league fixtures. The first observation of each fixture establishes a baseline silently. A subsequent kickoff date or time change, an explicit postponement, or a new kickoff for a postponed match sends a notification with Korean Standard Time and a link to that match. Completed matches and moved-from placeholders do not trigger change notifications. This uses the published `data.js` schedule, so edits become eligible after the site publishes them.

Schedule snapshots and pending changes use the existing `app_settings` table. Temporary delivery failures are retried for up to 24 hours, or until the new kickoff if it comes sooner. Delivery receipts prevent sending the same change again to subscriptions that already received it.

## Calendar subscription

`GET /calendar/chizumulu.ics` publishes the current Chizumulu league season as a public iCalendar feed. It reads the same published league schedule as the notifications and does not require a push subscription. Copy the HTTPS address into a calendar that accepts URL subscriptions, or use the site's button to open a `webcal:` subscription. The calendar app controls how often it refreshes.

Kickoff times are published in UTC using the Malawi time in the source schedule. Events keep the same UID when the kickoff moves. Known postponed or cancelled fixtures are marked as cancelled until a new date is published, and fixtures without a kickoff are omitted. The existing one-time downloads remain available in the dialog.

The Worker records successful deliveries per notification and subscription in D1. Overlapping polls share the delivery state, and retries skip subscriptions whose delivery is already recorded. Delivery records expire after two days.

The source API is independent of NRFA and may be delayed, corrected, or unavailable. The Worker retries on its next scheduled run; it cannot make a new API update arrive earlier.

## PWA requirements

Users must allow notifications. On iPhone and iPad, they must install the site to the Home Screen and use iOS/iPadOS 16.4 or later. Android users need a browser that supports installed PWA Web Push. The PWA can be closed after subscription; the push services deliver notifications to the device in the background.
