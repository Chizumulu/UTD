# 1-H-5 through 1-H-10 integrated optimization: preflight

## Measurement first
Pinned historical post-JavaScript reference: def5d8846167fcb2699ac5f416028e46afebe2d4.
Pinned currently deployed post-CSS candidate: 16d4bcdff8a85e3dba4c76ebbdcc04fc5baa0d4d (PR #146).
Run five accepted cold samples per device and revision (20 total), alternating order on one runner with the existing compressed Pages server, Lighthouse 12.8.2, simulated throttling, Korean language and existing blocked analytics/push patterns. Keep original baseline evidence unchanged. This is a lab comparison, not real-user telemetry.

The PR-specific plan is read-only and applies only to its exact head branch. After review of the preflight results, update that plan to compare #146 with the new PR head and repeat the same protocol. Do not merge this preflight by itself.

## Confirmed source observations, not measured causes
- 1-H-5: existing early hero executes at the end of app.js; data.js and app.js are synchronously inserted near the end of index.html with matching preloads. Profile LCP node, load delay and render delay before altering ordering.
- 1-H-6: Clarity is already deferred and Anime.js async in Pages builds; GA/GTM and push integration must keep their behavior. The existing benchmark blocks four external domain families, so it cannot establish real third-party CPU savings. Use a separate controlled check for those dependencies.
- 1-H-7: existing crest variants are already generated. Inventory actual image requests and LCP assets before introducing further responsive image variants or lazy loading.
- 1-H-8: 92 local Pretendard subsets are defined inline; two font files are preloaded and Google Noto Sans KR is nonblocking. Identify actual requested subsets, sizes, duplicate downloads and language coverage before changing preload strategy.
- 1-H-9: existing layout batching and early startup improvements remain; profile main-thread groups, DOM work and optional CSS insertion overhead. Check first and repeat navigation as well as cold homepage.
- 1-H-10: inspect measured layout-shift nodes before reserving space or changing fonts/hero structure; preserve responsive and modal accessibility behavior.

## Scope and merge gate
One integrated draft PR, feature-level commits after preflight, targeted checks plus existing full CSS/browser/SEO/analytics/publication regression suites. Compare candidate against #146 on the same runner. Document measured gains, regressions and variability; no unverified speed claim. No source data.js restructuring, writer automation, new analytics tracking, or notification policy changes in this phase. Keep source assets and deployment-only transforms where appropriate. If a proposed change has no demonstrated benefit, retain the current code.

Status: measurement requested; no new performance result and no feature optimization code yet.
