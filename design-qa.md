# Gongzuo design QA

**final result: passed**

Updated 2026-11-12. Real-browser interaction tests, automatic visual checks, and direct review of the final screenshots against the selected reference passed for the documented surfaces and flows. External delivery and the validation limits below remain separate.

## Source visual truth

- Selected concept: option 2, 共作 / Gongzuo, grey elephant coordinator, blue and white team workbench.
- Reference: `docs/design/gongzuo-selected-reference.png`.
- Reference pixels: 1487 × 1058. Comparison viewport: 1487 × 1058 CSS px, device scale factor 1, Chinese, light theme, six-role team builder with coordinator inspector open.
- Implementation: the real DSH plugin in `ds-bot/src/client/team-*.js`, generated `ds-bot/client.js`, six original transparent PNG characters, and the original brand mark.
- Product fixes: `e9a9caf35aa0f3f7c6d763af063859a48dee5ac8`. Evidence-classification correction: `5fd34ac846aa7a51787f3adf232f363e1fd24fb0`.

## Resumed browser verification

The existing implementation was restored to an isolated checkout on the connected Simular computer. Chrome 157 and Node.js 24.21 successfully ran the real DSH `0.2.2-rc.1` application with its scripted mock model. Authentication remained enabled; no user DSH profile or real provider credential was used.

| Evidence | Result | Scope |
|---|---|---|
| `docs/design/verification/2026-11-12-resume/final-ui/result.json` | 13 steps passed | Template and role selection, names, actual available model/permission presets, customized-instruction protection, appearance changes, draft reload, creation, persisted settings, dashboard/inbox navigation, keyboard order, and phone/tablet layouts |
| `docs/design/verification/2026-11-12-resume/task-final/result.json` | 8 steps passed | Existing-team lookup, first-Goal receipts, coordinator execution, real question creation, inbox navigation, answer verification, and pending-item removal |
| `docs/design/verification/2026-11-12-resume/visual-final/result.json` | Automatic checks passed | Light/dark surfaces, six loaded role images without inherited photo frames, reduced motion, and absence of page/console errors |

Creating and configuring the six-member team kept model-call counts at **0 before and 0 after**. Task-flow recovery reused the already submitted test Goal rather than submitting it again. Execution receipts identify the coordinator's group Session; the other five members remained dormant. The question-answer check matched the actual `selected: ['改标题']`, question ID, call ID, and coordinator Session before accepting that the inbox item cleared.

Automatic group/private-chat memory reviews are classified separately using their actual receipts. They are neither counted as another Agent starting work nor silently discarded as arbitrary background traffic.

The additional read-only receipt audit accounted for all 10 requests: 1 `coordinator-group`, 1 `group-memory-review`, 4 `coordinator-private`, and 4 `coordinator-private-memory-review`; unknown requests were 0 and the other five members remained dormant. Both the local 57-step smoke bench and the remote `gongzuo-final-ui` bench were stopped; their mock and Web test services are no longer running.

## Findings and fixes

| Finding | Fix and verification | Status |
|---|---|---|
| P0 — Every role image returned HTTP 400 in the actual DSH application | Added the required `requestBody: 'buffered'` to the exact artwork routes. A real authenticated DSH HTTP regression reproduced 400 before the fix and now verifies all seven PNGs, GET/HEAD/304, unauthenticated 401, and unknown-ID 404. Chrome now loads all six role images. | Fixed |
| P1 — Narrow-screen footer controls overlapped | Changed the phone footer to two rows. Browser geometry assertions verify that Back, member count, and Next stay inside the viewport and do not overlap; final phone/footer captures are readable. | Fixed and visually verified |
| P2 — Transparent role art inherited a photo frame | Removed the inherited image frame for preset raster characters. Computed `box-shadow` is `none` for all six illustrations, and the final captures show complete illustrations without square frames. | Fixed and visually verified |
| P2 — The member Role label remained in English in the Chinese UI | Added the Chinese copy and rebuilt the generated client; the final inspector displays the translated label. | Fixed and visually verified |

## Required fidelity surfaces

| Surface | Observed evidence | Final visual conclusion |
|---|---|---|
| Fonts and typography | Chinese browser captures at the reference viewport; larger team headings and shared font tokens | Passed: headings, fields, and selection states have clear hierarchy; real system fonts are an accepted difference from the concept |
| Spacing and layout | Three-column role grid and inspector rendered; 390px and 768px checks passed; footer controls have non-overlapping bounds | Passed: desktop composition follows the selected direction; the phone uses a scrollable two-column card grid and a primary button on its own footer row |
| Colors and tokens | Light background `rgb(251, 252, 255)` / text `rgb(23, 29, 43)`; dark background `rgb(17, 23, 34)` / text `rgb(237, 241, 250)` | Passed: the light blue/white composition and dark-theme text and imagery remain clear |
| Images | All six original PNGs loaded; computed photo-frame shadow is `none`; authenticated resource routes tested over real HTTP | Passed: all six distinct illustrations are complete and free of square frames |
| Copy and content | Chinese role labels, real member settings, review, result, and inbox captured | Passed for reviewed surfaces: fields and controls are readable; English custom names in the screenshots are test data |
| Motion and input | `prefers-reduced-motion: reduce` observed; name-to-role Tab sequence and phone navigation passed | Tested scope passed |

## Screenshot evidence

Evidence lives under `docs/design/verification/2026-11-12-resume/`:

- `final-ui/`: complete passing builder, inspector, review, creation-result, dashboard, inbox, phone, and tablet captures.
- `task-final/`: passing Goal and question/answer flow captures.
- `visual-final/`: `light-builder.png`, `dark-builder.png`, `member-inspector.png`, `mobile-builder.png`, and `mobile-footer.png`, with computed-style results.
- `before/`: earlier browser captures retained to show the footer/frame defects before the product fixes. These are historical evidence, not the accepted final UI.

The complete evidence directory contains 32 PNGs (29 in the resumed-run archive plus 3 in `before/`) and 7 JSON records. Historical failures and the initial Goal receipt are retained alongside the final passing results. The archive was unpacked and checked; a sensitive-field scan found no sensitive fields.

## Final image review

The final `light-builder.png` and `member-inspector.png` were opened and compared directly with `docs/design/gongzuo-selected-reference.png`. The mobile builder/footer, dark builder, dashboard, and answered-question captures were also opened and reviewed.

The six-character artwork is complete and has no square photo frames. The blue/white three-part composition, six role cards, and member inspector follow the selected option 2 direction. Headings, field labels, and selected states are distinct. At 390px, the two-column cards remain scrollable, the member count is readable, and the primary footer button occupies its own row without overlap. The dark capture keeps text and imagery clear.

Accepted differences from the concept are explicit: the implementation retains the existing product navigation, inbox and chat entries, and more detailed runtime settings; it uses real system fonts and more compact cards. This is acceptance of the selected design direction and working implementation, not a claim of pixel-identical reproduction. English member names in some captures were entered by the automated test.

## Earlier blocked attempt

The preceding delivery correctly recorded `blocked`: the shared browser could not reach the local preview, local Chromium exited with `process_singleton_posix.cc: socket() failed: Operation not permitted (1)`, and the official headless-shell download returned an HTML Site Unavailable response. That attempt produced no successful implementation screenshot and claimed no visual comparison.

On resumption, one local retry confirmed the same Chromium restriction. The connected Simular computer then supplied a working browser environment. Its first real UI run exposed the image HTTP 400, and later captures exposed the narrow footer and image-frame problems. The fixes and passing browser results above supersede the old browser-execution blocker while preserving that failure history.

## Validation limits

1. Mock-backed browser tests establish the interactions and routing they cover. They do not establish real model quality, automatic Goal planning/stage completion, or successful work by a paid provider/local CLI.
2. The question flow exercises real `ask_user` and answer handling. Permission-approval button flows and network-failure recovery injection were not exercised by these browser scripts; backend recovery has separate unit/API coverage.
3. Windows/macOS/Linux installer packaging and cross-platform installation remain unverified. Hard budgets, mandatory independent-review gates, and concurrent-file locks remain unimplemented.

## External delivery status

The fork exists, but the implementation commits have not been pushed. No implementation PR or CI run is claimed: the current CLI environments and browser have no GitHub login, and no installed GitHub connector is available. This authentication blocker is separate from the now-completed real-browser execution checks.
