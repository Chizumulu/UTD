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

## Polling and notifications

The Cron Trigger runs every two minutes. Change the expression in `wrangler.jsonc` to adjust the frequency. The Worker checks up to 100 recent matches for `teamId=chizumulu_united` and `competitionCode=nrfa_league_one`, ignores stale live rows older than 45 minutes, and skips notifications for the first poll so existing results do not generate a burst of alerts. It also reads `scheduledRounds` from the public site `data.js` and sends a one-hour kickoff reminder for unplayed Chizumulu fixtures with a date and time. The schedule strings use Malawi local time (Central Africa Time, UTC+02:00), as used by the site and its calendar downloads. Some fixture times in `data.js` are explicitly marked as provisional 15:00 defaults, so reminders use those values until the schedule is corrected.

Push subscriptions are stored in D1. Expired subscriptions that return HTTP 404 or 410 are removed automatically. The notification card is tagged by match so later score updates replace the prior card where the platform supports it.

The source API is independent of NRFA and may be delayed, corrected, or unavailable. The Worker retries on its next scheduled run; it cannot make a new API update arrive earlier.

## PWA requirements

Users must allow notifications. On iPhone and iPad, they must install the site to the Home Screen and use iOS/iPadOS 16.4 or later. Android users need a browser that supports installed PWA Web Push. The PWA can be closed after subscription; the push services deliver notifications to the device in the background.
