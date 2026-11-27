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

## Latest deployed-design reference and first conservative batch
Run 46083168355 / artifact 15237852405: 20 valid reports, each revision/device n=5; all 20 attempt histories and ZIP integrity checked. Deployed design reference is now #148 (0ffafd04b3e22461c7968a1322e065aa273acc46). Mobile score 62, FCP 4816.5 ms, LCP 7532.02 ms, TBT 110 ms, CLS 0.07, main thread 2395.89 ms; desktop score 89, FCP 926.59 ms, LCP 1490.8 ms, TBT 0, CLS 0.14. Mobile LCP load-delay estimate 4006.68 ms, render-delay estimate 2825.47 ms. Baseline comparison has high variability in mobile main thread and JS execution; do not infer causal improvement in CLS from unrelated runs. Laboratory only, with analytics/push domains blocked.

Actual raw audit mobile-after-1: no98.png 120595 transfer bytes, no22.png 114728 transfer bytes; both player photos are displayed at 38x38 CSS px. No duplicate exact font URLs in that sample (15 font requests, 414680 transferred bytes). The Lighthouse responsive-image and modern-format opportunities overlap and imply potentially different rendered pixels, so do not apply their estimated savings blindly.

### Batch 1 decision
- Implement 1-H-7 lossless-only PNG recompression for the two observed assets in deployment copies. Same dimensions, mode, decoded pixels and every non-IDAT chunk; skip unsupported modes/animation/unknown chunks or non-shrinking output. No resizing, URL changes, source asset changes or color loss.
- Before Lighthouse, compare the entire deployed asset inventory and exact bytes against #148, with only the two verified PNG payloads and publication commit receipt allowed to differ. Existing browser and cold CSS parity tests remain required.
- Keep 1-H-5, 6, 8, 9 and 10 pending: no safe measured benefit established yet for specific additional transformations. No changes to Hero, timing, fonts, animations, third-party collection, CSS, app.js or source assets. More aggressive resource prioritization, responsive photos or layout-shift reservation could change loading appearance and require prior approval under AGENTS.md.
- Rebenchmark #148 against exact PR head with five samples per device/revision. Do not claim compression savings or improved Lighthouse results until actual build/test results arrive. If there is no reduction, retain original output.
- The binary asset parity gate is intentionally scoped to this lossless-only batch, not a replacement for visual comparison when future HTML/JS/CSS/font changes are approved.
