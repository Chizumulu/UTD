# UTD Admin Center — read-only phase 1

Deploy only after CI passes. Set Worker secret ADMIN_CENTER_TOKEN to a cryptographically random 32-byte hex string (64 characters). Set Worker variable ADMIN_CENTER_ENABLED=true. Do not reuse DIAGNOSTIC_TOKEN. Never paste the key in chat, URLs or source code. The login shell is public but status endpoints require the separate key; key stays in page memory and is cleared on logout/page exit. No browser storage, cookies, writes, CORS or third-party scripts. Cloudflare Access and edge rate limiting are recommended defense in depth, not configured here.

Daily credential probes run independently on existing Worker cron. GitHub identity, WhatsApp phone/templates read access and Instagram business discovery are checked, not send/write permissions. Expiry only if upstream returns a parseable expiration header; Meta expiry introspection, OneSignal and Cloudflare management API are not implemented. No test messages are sent.

After first successful Worker report, add the same key as GitHub Actions secret UTD_ADMIN_CENTER_TOKEN, then set Actions variable UTD_ADMIN_CENTER_ENABLED=true. The daily independent workflow reads the protected credential summary, opens a generic public issue on warnings/failure and closes on recovery. No credential details in public workflow logs/issues. Existing monitoring remains independent. Dashboard GitHub run data is anonymous and bounded to latest 100 main runs; rate limiting or absent history is shown as unknown.

Disable both flags to roll back. Rotate the Worker secret and matching Actions secret together. No data.js changes. No control endpoints or pending approval counts in this phase.
