# Gongzuo design QA

**final result: blocked**

## Source visual truth

- Selected concept: option 2, 共作 / Gongzuo, grey elephant coordinator, blue and white team workbench.
- Reference: `docs/design/gongzuo-selected-reference.png`.
- Reference pixels: 1487 × 1058. Intended comparison viewport: 1487 × 1058 CSS px, device scale factor 1, Chinese, light theme, initial six-role team builder with coordinator inspector open.
- Implementation: the real DSH plugin in `ds-bot/src/client/team-*.js`, with generated `ds-bot/client.js`; six individually generated transparent PNG role illustrations and the original brand mark are packaged by the host.

## Browser evidence and blockers

No successful browser-rendered implementation screenshot was obtained. Source code and successful builds are not treated as visual evidence.

1. Started the isolated real DSH preview with the pinned runtime and scripted model. A request made from inside its process namespace returned HTTP 401, confirming that the authenticated runtime was listening. Authentication was not disabled.
2. The shared cloud browser could not reach `http://terminal.local:4173/`; navigation timed out and displayed an upstream connection termination. The preview manager's reported relay address was also rejected by the browser. No firewall, authentication, or browser security setting was weakened.
3. Tried automated Chromium in the same isolated namespace as DSH using `ds-bot/dev/team-ui.mjs`. Chromium exited before page creation: `process_singleton_posix.cc: socket() failed: Operation not permitted (1)`.
4. Tried the official Playwright headless-shell installer. Its download URL returned a 195-byte HTML “Site Unavailable” response instead of a ZIP, so that browser could not be installed.

The test bench was stopped after the failed browser run. No user DSH profile, real model key, or production session was used by this test.

## Required fidelity surfaces

| Surface | Implemented source | Visual conclusion |
|---|---|---|
| Fonts and typography | Existing shared font tokens; larger team headings; Chinese copy | Blocked: actual font rendering, wrapping and optical weight not observed |
| Spacing and layout | Sidebar, three-column role grid, member inspector; responsive breakpoints | Blocked: viewport overflow, density and mobile controls not visually verified |
| Colors and tokens | Gongzuo blue/white theme plus compatible dark theme | Blocked: rendered contrast and palette not compared |
| Images | Six original transparent raster characters and a brand mark; exact allowlisted asset routes | Asset files inspected; browser loading, masking and scale remain unverified |
| Copy and content | Chinese and English team flow, role summaries and settings; explicit language fallback elsewhere | Source-level i18n tests passed; rendered truncation and layout not observed |

## Findings

- **P1 — Visual comparison unavailable.** No full-view or focused-region comparison can be claimed. The source reference and a successful implementation screenshot must be opened together at the same viewport and state before changing this result to passed.
- **P1 — Browser flow verification unavailable.** Unit and real DSH API smoke tests cover team creation and execution behavior, but do not establish that browser interactions are usable.

## Comparison history

No visual comparison iteration occurred. Preview troubleshooting, compilation, unit tests, and API smoke tests are not counted as visual QA iterations. There are no fabricated implementation screenshots or claimed pixel matches.

## Remaining implementation verification

1. Run the isolated preview and authenticate using its locally generated login URL.
2. Run `node dev/team-ui.mjs gongzuo-ui 4174` in an environment where Chromium is supported; set `CHROME_BIN` when needed. The bench must remain alive in the same process environment.
3. Capture the six-role builder, member appearance/settings, review and creation result at the reference viewport; compare both full view and inspector/card details with the selected reference.
4. Exercise template switching, role selection, custom-instruction protection, actual model and permission selection, create/recover, dashboard navigation, first Goal, and answerable inbox items.
5. Check mobile/tablet widths, focus order, reduced motion, image failures, and browser console errors. Fix P0/P1/P2 findings, recapture, and only then set `final result: passed`.

## Delivery status

The code implementation and nonvisual verification can be delivered for review. The UI has **not** passed visual acceptance, and desktop installer packaging has not been validated on every operating system in this environment.
