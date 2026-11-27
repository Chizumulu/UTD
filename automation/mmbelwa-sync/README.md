# Mmbelwa Cup discovery (phase 1, read-only)

Reads existing mmbelwaCup entry and team aliases from data.js. Scans the latest 40 Structured API items every 10 minutes when the existing UTD_HEALTH_MONITOR_ENABLED variable is true, or manually. GitHub scheduled runs can be delayed. Uses explicit Mmbelwa Cup evidence, rejects conflicting league/FA Cup markers, and holds unknown codes and teams. Reports candidate rows and announcement-only posts in Actions logs and a seven-day artifact. Deduplicates identical rows within a scan only.

No production writes, alerts, PRs, Worker changes, fabricated fixtures, or automatic activation even if rounds become populated. This is discovery, not a fixture update engine. Real API code, round format, date/time and venue semantics, and official draw must be verified before a later write-enabled implementation. API coverage is limited to the latest 40 items; image-only draws or items without explicit extracted cup evidence may be missed. No cross-run alert deduplication is needed because this phase sends no notifications.

Tests use synthetic input only; production team registry is read-only. Existing FA Cup implementation is unchanged.
