# UTD automation health monitor

Phase 1: Worker cron heartbeat, consecutive scanner failures, independent GitHub Actions polling of Worker heartbeat, Structured API JSON shape and Pages HTTP status. The report exposes only timestamps, scanner names and coarse statuses; no credentials or error detail. Three consecutive scanner failures mark degraded; heartbeat older than 40 minutes marks stale. Disabled Instagram is not an error.

Activation:
1. Deploy the Worker with HEALTH_MONITOR_ENABLED=true.
2. Confirm /health/automation returns HTTP 200 after a cron execution and inspect automation_health_summary.
3. Add repository Actions variable UTD_HEALTH_MONITOR_ENABLED=true. Run UTD automation health manually to verify. Scheduled checks target 15 minutes; GitHub may delay or skip scheduled runs.
4. Incidents use one open GitHub Issue, closed on recovery. GitHub notifications depend on account settings.

No WhatsApp template required. This phase does not independently test WhatsApp delivery, OneSignal, webhooks, every GitHub workflow or data freshness; successful scanner execution is not proof of end-to-end delivery. Existing logs and approval workflows remain in place. KV is eventually consistent. Disable either flag to stop its corresponding monitor (close open incidents manually if disabling intentionally).

Tests: node --test automation/health-monitor/health.test.mjs
