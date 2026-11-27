# 1-H-4-1 CSS audit

Run UTD CSS ownership and coverage audit in Actions. The workflow builds actual Pages assets without changing source CSS, parses the deployed stylesheet using PostCSS, and captures Chromium CSS coverage in fresh browser contexts. All external requests are blocked for reproducibility; the resulting coverage is not representative of every live/network-dependent state.

Four profiles (desktop Korean, mobile Korean, narrow dark English, tablet Chichewa) each run sixteen scenarios. Coverage includes initial navigation and the exercised feature, not exclusive feature usage. The report provides observed unions and per-scenario data. Exact stylesheet text identity is mandatory before merging offsets. Failed scenarios fail CI and retain samples/failures/install logs for debugging.

Ownership is a conservative selector-name heuristic, not proven exclusivity. Mixed, unknown, shared and home rules are protected; even exclusively named rules require cascade and runtime verification before extraction. Repeated selector occurrences are not necessarily duplicates. Variable references and raw animation values are indexed, not a complete dependency graph. Raw rule bytes exclude wrappers and comments; compressed sizes describe the complete stylesheet only. Coverage is rule-level: declaration counts are declarations inside wholly unobserved rules, not proof of individual dead declarations. No automatic deletion or production CSS split is performed.

Artifacts: ownership.json, coverage.json, samples.json, failures.json, report.md and installation logs. The report is also printed in the job summary. Subsequent work should add feature states (match detail, comparison, popups, live states, hover/focus, breakpoint changes) and visual regression before any extraction. CSS coverage from Chromium alone does not establish cross-browser equivalence.

## Failure handling

The prediction and sponsor scenarios wait for normal rendered content, not retry controls; prediction also exercises model and outlook tabs. The manifest lists expected scenario identities. Incomplete runs retain partial ownership and coverage reports with an explicit INCOMPLETE warning, missing scenarios, and a nonzero CI exit. Failed scenarios save bounded screenshots and JSON with target selector, current route, visible panels, page errors, console errors and same-origin request failures. No partial report authorizes CSS extraction.
