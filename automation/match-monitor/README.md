# Match missing monitor

Disabled by default. Configure Worker variables after testing:

- MATCH_MISSING_ENABLED=true
- MATCH_MISSING_START_AT: explicit ISO timestamp with offset, before the first intended kickoff.
- MATCH_MISSING_TEMPLATE_NAME=utd_match_missing_alert (only after Meta approval)
- MATCH_MISSING_TEMPLATE_LANGUAGE=ko

Template: no buttons, five body variables in order: competition, fixture, kickoff (KST), elapsed threshold, reason. Example body: 경기 결과 미반영 안내 / 대회: {{1}} / 경기: {{2}} / 킥오프: {{3}} / 경과: {{4}} / 확인 사항: {{5}} / 사이트 기록을 확인해 주세요.

Without a template name the monitor logs detections only. The latest API window is limited to 40 items; absence is not proof of no official result. Scheduled times can be provisional. A result in data.js or the cup snapshot stops warnings. KV is best-effort deduplication, not exactly-once delivery. Only the newest overdue threshold is sent, and monitoring stops seven days after kickoff. No match data is modified. Test with node --test automation/match-monitor/missing.test.mjs.
