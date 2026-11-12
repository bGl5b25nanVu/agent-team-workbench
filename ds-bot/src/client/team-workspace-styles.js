import { SPRING_SHAPE, SPRING_TAP, spring } from './motion.js'

// The selected Gongzuo design uses larger role illustrations and page headings;
// chat typography, theme colors, motion preferences, and existing dialogs stay shared.
export const TEAM_WORKSPACE_CSS = `
.gw-workspace{position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;z-index:24;overflow:auto;background:var(--bt-main);color:var(--bt-ink);font:14px/1.55 var(--bt-font);box-sizing:border-box;overscroll-behavior:contain;outline:none;animation:gw-page-in ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
.gw-workspace[data-leaving]{pointer-events:none;animation:gw-page-out .16s ease forwards}
.gw-workspace *{box-sizing:border-box}
.gw-workspace h1,.gw-workspace h2,.gw-workspace h3,.gw-workspace p{margin:0}
.gw-workspace button,.gw-workspace input,.gw-workspace select,.gw-workspace textarea{font:inherit}
.gw-workspace button{touch-action:manipulation}
.gw-workspace :is(button,input,select,textarea,summary):focus-visible,.gw-nav button:focus-visible{outline:2px solid var(--bt-accent);outline-offset:3px}
.gw-workspace button:disabled{cursor:not-allowed;opacity:.45}
.gw-workspace h1{font-size:34px;line-height:1.25;font-weight:600;letter-spacing:-.035em}
.gw-workspace h2{font-size:22px;line-height:1.35;font-weight:600;letter-spacing:-.02em}
.gw-workspace h3{font-size:17px;line-height:1.4;font-weight:600}
.gw-lead{font-size:17px;line-height:1.6;color:var(--bt-ink-2);margin-top:8px!important}
.gw-page{padding:36px 40px 48px;max-width:1500px;margin:0 auto}
.gw-page-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}
.gw-primary,.gw-outline,.gw-text-btn,.gw-blueprint,.gw-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;min-height:40px;padding:8px 18px;border:1px solid transparent;cursor:pointer;line-height:22px;white-space:nowrap;transition:background-color .12s ease,color .12s ease,border-color .12s ease,${spring(SPRING_TAP,'scale')}}
.gw-primary{background:var(--bt-accent);color:var(--bt-accent-ink);font-weight:600!important}
.gw-primary:hover:not(:disabled){filter:brightness(1.06)}
.gw-outline{background:var(--bt-card);border-color:var(--bt-line-2);color:var(--bt-ink-2)}
.gw-outline:hover:not(:disabled),.gw-text-btn:hover:not(:disabled),.gw-icon-button:hover{background:var(--bt-hover);color:var(--bt-ink)}
.gw-primary:active:not(:disabled),.gw-outline:active:not(:disabled),.gw-text-btn:active:not(:disabled),.gw-blueprint:active{scale:.98}
.gw-text-btn,.gw-icon-button{background:transparent;color:var(--bt-ink);padding:6px 8px}
.gw-icon-button{width:40px;padding:8px}
.gw-small{min-height:32px;font-size:12px!important;padding:4px 10px}
.gw-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.gw-center{justify-content:center}
.gw-field{display:flex;flex-direction:column;gap:8px;min-width:0;margin:0 0 20px}
.gw-label{font-size:14px;font-weight:500;color:var(--bt-ink)}
.gw-input{width:100%;min-width:0;min-height:40px;border:1px solid var(--bt-line-2);border-radius:10px;background:var(--bt-card);color:var(--bt-ink);padding:8px 12px;outline:none}
.gw-input:hover{border-color:color-mix(in srgb,var(--bt-accent) 30%,var(--bt-line-2))}
.gw-input:focus{border-color:var(--bt-accent)}
textarea.gw-input{resize:vertical;line-height:1.65}
.gw-note{font-size:12px;line-height:1.7;color:var(--bt-ink-2)}
.gw-error{font-size:13px;line-height:1.7;color:var(--bt-danger);padding:12px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.gw-notice{padding:16px 20px;border-radius:12px;border:1px solid var(--bt-line);background:var(--bt-sidebar);color:var(--bt-ink-2);font-size:13px}
.gw-wizard{padding:32px 32px 0;min-height:100%;display:flex;flex-direction:column}
.gw-wizard-layout{display:grid;grid-template-columns:minmax(0,1fr) 306px;gap:28px;flex:1}
.gw-picker{min-width:0;padding-right:0}
.gw-picker .gw-page-head{margin:0 0 24px}
.gw-team-form{display:flex;flex-direction:column;gap:12px;padding:0 0 24px;border-bottom:1px solid var(--bt-line);margin-bottom:24px}
.gw-team-form>.gw-field{display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;gap:16px;margin:0}
.gw-team-form .gw-input{max-width:464px}
.gw-blueprint-options{display:flex;gap:10px;flex-wrap:wrap}
.gw-blueprint{border-color:var(--bt-line);color:var(--bt-ink-2);background:var(--bt-card);padding:8px 16px}
.gw-blueprint[aria-pressed=true]{border-color:color-mix(in srgb,var(--bt-accent) 45%,var(--bt-line));color:var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 10%,var(--bt-main))}
.gw-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.gw-role-card{position:relative;min-width:0;border:1px solid var(--bt-line);border-radius:20px;background:var(--bt-card);overflow:hidden;transition:background-color .12s,border-color .12s}
.gw-role-card[data-active]{border:1.5px solid var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 4%,var(--bt-main))}
.gw-role-card:not([data-selected]) .gw-role-art{opacity:.5}
.gw-role-detail{width:100%;display:flex;flex-direction:column;align-items:center;border:0;border-radius:20px;background:transparent;color:var(--bt-ink);padding:14px 8px 18px;cursor:pointer}
.gw-role-detail:hover{background:color-mix(in srgb,var(--bt-accent) 3%,transparent)}
.gw-role-detail:focus-visible{outline-offset:-4px!important}
.gw-role-art{display:flex;align-items:center;justify-content:center;width:100%;height:190px}
.gw-role-art>.bt-mark{max-width:100%;flex:none}
.gw-role-title{display:flex;align-items:center;justify-content:center;gap:8px;font-size:20px;font-weight:600;margin-top:8px}
.gw-role-summary{font-size:13px;line-height:1.6;color:var(--bt-ink-2);margin-top:6px;text-align:center}
.gw-chip{font-size:11px;font-weight:500;border-radius:4px;padding:1px 5px;background:color-mix(in srgb,var(--bt-accent) 12%,transparent);color:var(--bt-accent)}
.gw-role-check{position:absolute;right:12px;top:12px;width:28px;height:28px;cursor:pointer}
.gw-role-check input{position:absolute;inset:0;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}
.gw-role-check>span{display:flex;align-items:center;justify-content:center;width:24px;height:24px;margin:2px;border:1px solid var(--bt-line-2);background:var(--bt-card);border-radius:8px;pointer-events:none}
.gw-role-check input:checked+span{background:var(--bt-accent);color:var(--bt-accent-ink);border-color:var(--bt-accent)}
.gw-role-check input:focus-visible+span{outline:2px solid var(--bt-accent);outline-offset:3px}
.gw-role-check svg{width:20px;height:20px}
.gw-inspector{min-width:0;padding:20px 0 24px 24px;border-left:1px solid var(--bt-line)}
.gw-inspector h2{font-size:22px}
.gw-inspector-hero{display:flex;align-items:center;gap:12px;margin:20px -8px 20px}
.gw-inspector-hero h3{font-size:22px;margin:0 0 12px}
.gw-inspector-hero>.bt-mark{flex:none}
.gw-inspector .gw-field{margin-bottom:20px}
.gw-inspector .gw-input{font-size:13px}
.gw-responsibility{margin-bottom:24px}
.gw-responsibility p{margin-top:8px;color:var(--bt-ink-2);font-size:13px;line-height:1.7}
.gw-responsibility small{display:block;color:var(--bt-ink-2);font-size:12px;line-height:1.65;margin-top:6px}
.gw-more{border-top:1px solid var(--bt-line);padding-top:16px;margin-top:24px}
.gw-more>summary{cursor:pointer;list-style:revert;font-weight:500;margin-bottom:20px}
.gw-look-options{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}
.gw-look-choice{border:1px solid var(--bt-line);border-radius:10px;padding:2px;background:var(--bt-card);cursor:pointer}
.gw-look-choice[aria-pressed=true]{border-color:var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 8%,var(--bt-card))}
.gw-prompt-change{background:var(--bt-sidebar);border:1px solid var(--bt-line);border-radius:12px;padding:12px;margin-bottom:20px}
.gw-prompt-change pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:12px;line-height:1.7}
.gw-prompt-change summary{cursor:pointer;padding-block:8px;font-size:12px}
.gw-prompt-change strong{font-size:13px}
.gw-instructions{font-family:var(--bt-font);font-size:12px!important;max-height:440px;min-height:180px}
.gw-wizard-footer{display:flex;align-items:center;gap:20px;border-top:1px solid var(--bt-line);padding:18px 0 22px;margin-top:24px;flex:none;background:var(--bt-main);position:sticky;bottom:0;z-index:3}
.gw-wizard-footer>.gw-primary{margin-left:auto}
.gw-selection-summary{display:flex;align-items:center;gap:16px;border-left:1px solid var(--bt-line-2);padding-left:24px;min-width:0}
.gw-selection-summary strong{font-size:15px;white-space:nowrap}
.gw-selection-summary span{font-size:12px;color:var(--bt-ink-2)}
.gw-reset-draft{align-self:flex-start;font-size:11px!important;margin-bottom:12px;color:var(--bt-ink-2)}
.gw-review{padding:36px 40px 0;max-width:1100px;margin:0 auto}
.gw-review-card{border:1px solid var(--bt-line);border-radius:20px;padding:28px;background:var(--bt-card)}
.gw-review-members{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:20px 0 24px}
.gw-review-member{display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid var(--bt-line)}
.gw-review-member>.bt-mark{flex:none}
.gw-review-member>div{min-width:0;flex:1}
.gw-review-member strong{font-size:14px}
.gw-review-member p,.gw-review-member small{font-size:12px;color:var(--bt-ink-2);overflow-wrap:anywhere}
.gw-review-card .gw-notice{margin-top:16px}
.gw-creation-result{max-width:900px;padding:48px 32px;margin:0 auto;text-align:center}
.gw-result-face{margin-bottom:24px}
.gw-creation-result h2{margin-top:24px}
.gw-creation-result>.gw-actions{margin-top:28px}
.gw-creation-members{margin:24px 0;display:flex;flex-direction:column;gap:8px}
.gw-creation-member{display:flex;align-items:center;gap:16px;padding:10px 16px;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-card);text-align:left}
.gw-creation-member>.gw-status{margin-left:auto}
.gw-status{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:11px;line-height:18px;padding:3px 8px;border-radius:999px;color:var(--bt-ink-2);background:var(--bt-tag-bg)}
.gw-status[data-state=active]{background:color-mix(in srgb,var(--bt-accent) 10%,var(--bt-card));color:var(--bt-accent)}
.gw-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.gw-team-card{display:flex;flex-direction:column;text-align:left;padding:24px;border:1px solid var(--bt-line);border-radius:20px;color:var(--bt-ink);background:var(--bt-card);cursor:pointer;min-width:0;transition:border-color .12s}
.gw-team-card:hover{border-color:var(--bt-accent)}
.gw-team-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px}
.gw-team-card h2{font-size:20px;overflow-wrap:anywhere}
.gw-team-card p{color:var(--bt-ink-2);font-size:13px;margin-top:8px;min-height:40px}
.gw-team-card-foot{display:flex;align-items:center;gap:8px;color:var(--bt-ink-2);font-size:11px;margin-top:24px;padding-top:16px;border-top:1px solid var(--bt-line);width:100%}
.gw-team-card-foot>span:nth-child(2){margin-left:auto}
.gw-empty-team{text-align:center;border:1px solid var(--bt-line);border-radius:20px;padding:40px 24px;background:var(--bt-card)}
.gw-empty-team h2{margin-top:20px}
.gw-empty-team p{margin:10px auto 24px;max-width:420px;color:var(--bt-ink-2)}
.gw-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:28px}
.gw-stat{border:1px solid var(--bt-line);border-radius:16px;background:var(--bt-card);color:var(--bt-ink);padding:20px 24px;display:flex;align-items:center;gap:18px;text-align:left;cursor:pointer}
.gw-stat>svg{width:22px;height:22px;color:var(--bt-accent)}
.gw-stat>span{display:flex;flex-direction:column;gap:3px}
.gw-stat strong{font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums;font-weight:600}
.gw-stat small{font-size:12px;color:var(--bt-ink-2)}
.gw-room-switch{display:flex;align-items:center;gap:12px;margin:24px 0 16px}
.gw-room-switch label{display:flex;gap:12px;align-items:center;font-size:12px;color:var(--bt-ink-2);margin-right:auto}
.gw-room-switch select{width:240px}
.gw-goal-card{border:1px solid var(--bt-line);border-radius:20px;padding:28px;background:var(--bt-card)}
.gw-goal-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.gw-eyebrow{font-size:12px;color:var(--bt-accent);display:block;margin-bottom:8px;font-weight:500}
.gw-goal-card>p{color:var(--bt-ink-2);margin-top:12px;font-size:13px;white-space:pre-wrap}
.gw-goal-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:24px}
.gw-stage-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:24px}
.gw-stage{display:flex;flex-direction:column;gap:5px;align-items:flex-start;text-align:left;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-main);color:var(--bt-ink-2);padding:12px;cursor:pointer}
.gw-stage[data-state=active]{color:var(--bt-accent);border-color:var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 4%,var(--bt-main))}
.gw-stage span,.gw-stage small{font-size:11px}
.gw-stage strong{font-size:13px;overflow-wrap:anywhere}
.gw-task-section,.gw-member-section{margin-top:32px}
.gw-section-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}
.gw-section-heading h2{font-size:17px}
.gw-task-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}
.gw-task-column{background:var(--bt-sidebar);border-radius:12px;padding:12px;min-width:0}
.gw-task-column h3{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--bt-ink-2);margin-bottom:12px}
.gw-task-column h3 span{background:var(--bt-card);padding:1px 6px;border-radius:4px}
.gw-task-card{display:block;width:100%;text-align:left;border:1px solid var(--bt-line);border-radius:10px;background:var(--bt-card);color:var(--bt-ink);padding:12px;margin-top:8px;cursor:pointer}
.gw-task-card p{font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.gw-task-owner{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--bt-ink-2)}
.gw-task-empty{display:block;padding:24px 0;text-align:center;font-size:12px;color:var(--bt-ink-2)}
.gw-members-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.gw-member-card{display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--bt-line);border-radius:16px;background:var(--bt-card);color:var(--bt-ink);padding:16px 8px;cursor:pointer;min-width:0}
.gw-member-card strong{font-size:13px;max-width:100%;overflow-wrap:anywhere}
.gw-member-card>span:not(.bt-mark){font-size:11px;color:var(--bt-ink-2);text-align:center}
.gw-member-card .gw-status{margin-top:5px}
.gw-recovery-list{margin:0 0 24px;display:flex;flex-direction:column;gap:10px}
.gw-recovery{display:flex;align-items:center;justify-content:space-between;gap:20px}
.gw-recovery p{font-size:12px;margin-top:4px}
.gw-inbox-list{display:flex;flex-direction:column;gap:16px;max-width:1000px}
.gw-inbox-item{border:1px solid var(--bt-line);border-radius:16px;background:var(--bt-card);padding:24px}
.gw-inbox-owner{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.gw-inbox-owner>div{display:flex;flex-direction:column;font-size:13px}
.gw-inbox-owner span{font-size:12px;color:var(--bt-ink-2)}
.gw-inbox-item h2{font-size:17px}
.gw-inbox-item>p{font-size:13px;margin-top:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.gw-inbox-item>.gw-actions{margin-top:20px;justify-content:flex-end}
.gw-inbox-code{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,SFMono-Regular,monospace;padding:12px;background:var(--bt-sidebar);border-radius:8px}
.gw-inbox-empty{padding:72px 24px;text-align:center}
.gw-inbox-empty h2{margin-top:24px}
.gw-inbox-empty p{color:var(--bt-ink-2);margin-top:10px}
.gw-empty-check{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border:1px solid var(--bt-line);border-radius:20px;color:var(--bt-accent);background:var(--bt-card)}
.gw-empty-check svg{width:28px;height:28px}
.gw-count{font-size:22px;line-height:1;border-radius:12px;padding:16px;background:var(--bt-sidebar);color:var(--bt-accent)}
.gw-loading{padding:48px;color:var(--bt-ink-2)}
.gw-mobile-nav{display:none}
.gw-nav{display:flex;flex-direction:column;gap:6px;padding:18px 0 20px;border-bottom:1px solid var(--bt-line);margin-bottom:14px;flex:none}
.gw-nav button{display:flex;align-items:center;gap:14px;width:100%;min-height:42px;padding:10px 14px;text-align:left;border:0;border-radius:10px;background:transparent;color:var(--bt-ink);font:14px/22px var(--bt-font);cursor:pointer}
.gw-nav button svg{flex:none;width:20px;height:20px}
.gw-nav button:hover{background:var(--bt-hover)}
.gw-nav button[aria-current=page]{background:color-mix(in srgb,var(--bt-accent) 12%,var(--bt-sidebar));color:var(--bt-accent);font-weight:500}
.gw-nav-badge{margin-left:auto;min-width:20px;text-align:center;border-radius:999px;font-size:11px;background:var(--bt-card);color:var(--bt-accent)}
.bt-rail .gw-nav{padding:4px 14px 14px}
.bt-rail .gw-nav button{justify-content:center;padding:10px}
.bt-rail .gw-nav button span{display:none}
.bt-side-top .bt-brand{display:flex;align-items:center;gap:9px;margin-right:auto;padding-left:6px}
.gw-brand-image{display:block;object-fit:contain}
.bt-side-top .bt-brand-name{font-size:22px;font-weight:600;letter-spacing:-.04em}
.bt-side-top{flex-wrap:wrap;gap:3px}
.bt-side-top .bt-brand{min-width:calc(100% - 36px);margin-bottom:8px}
.bt-side-top .bt-brand+.bt-update{margin-left:auto}
.bt-side-top>.bt-side-collapse{margin-left:auto}
.bt-tile-wrap{width:100%!important}
.bt-tile{width:100%!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:10px!important;padding:10px!important;text-align:left!important}
.bt-tile>.bt-mark{width:44px!important;height:44px!important;flex:none}
.bt-tile>.bt-mark>.bt-mark{width:44px!important;height:44px!important}
.bt-tile .bt-tile-name{font-size:14px!important;margin:0!important}
.bt-tile .bt-chip{display:none}
@keyframes gw-page-in{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}
@keyframes gw-page-out{to{opacity:0}}
@media(min-width:1440px){.gw-wizard-layout{grid-template-columns:minmax(0,1fr) 332px;gap:32px}.gw-wizard{padding:36px 36px 0}.gw-role-art{height:190px}.gw-role-art>.bt-mark{width:190px!important;height:190px!important}.gw-role-detail{padding:14px 8px 18px}.gw-role-summary{font-size:14px}}
@media(max-width:1200px){.gw-wizard-layout{grid-template-columns:minmax(0,1fr) 272px;gap:20px}.gw-wizard{padding:28px 24px 0}.gw-role-grid{gap:10px}.gw-role-art{height:148px}.gw-role-art>.bt-mark{width:148px!important;height:148px!important}.gw-role-title{font-size:17px}.gw-role-summary{font-size:11px}.gw-inspector{padding-left:20px}.gw-inspector-hero>.bt-mark{width:116px!important;height:116px!important}.gw-inspector-hero h3{font-size:17px}.gw-blueprint{font-size:12px!important;padding:6px 10px}.gw-blueprint-options{gap:6px}.gw-workspace h1{font-size:28px}.gw-lead{font-size:14px}.gw-selection-summary span{display:none}.gw-page{padding:28px}.gw-members-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.gw-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:980px){.gw-wizard-layout{grid-template-columns:minmax(0,1fr)}.gw-inspector{border-left:0;border-top:1px solid var(--bt-line);padding:24px 0;display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.gw-inspector>h2,.gw-inspector-hero,.gw-more,.gw-look-options{grid-column:1/-1}.gw-inspector-hero{margin:12px 0 20px}.gw-inspector-hero>.bt-mark{width:116px!important;height:116px!important}.gw-role-art{height:180px}.gw-role-art>.bt-mark{width:180px!important;height:180px!important}.gw-role-summary{font-size:12px}.gw-role-title{font-size:20px}.gw-workspace h1{font-size:28px}.gw-task-board{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-review-members{grid-template-columns:1fr}.gw-team-form .gw-input{max-width:none}}
@media(max-width:700px){.gw-mobile-nav{display:flex;gap:4px;border-bottom:1px solid var(--bt-line);padding:8px 12px;overflow:auto}.gw-mobile-nav button{font-size:12px;padding:4px 10px}.gw-mobile-nav button[aria-current=page]{color:var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 10%,transparent)}.gw-wizard{padding:24px 18px 0}.gw-workspace h1{font-size:24px}.gw-lead{font-size:13px}.gw-role-art{height:140px}.gw-role-art>.bt-mark{width:140px!important;height:140px!important}.gw-role-title{font-size:17px}.gw-role-summary{font-size:11px}.gw-role-check{right:7px;top:7px}.gw-team-form>.gw-field{grid-template-columns:1fr;gap:8px}.gw-team-form .gw-label{font-size:12px}.gw-wizard-footer{gap:10px;padding:14px 0}.gw-wizard-footer>.gw-primary{font-size:12px!important;padding:8px 12px}.gw-selection-summary{padding-left:10px}.gw-selection-summary strong{font-size:12px}.gw-page{padding:24px 18px}.gw-page-head{align-items:flex-start;gap:12px}.gw-page-head>.gw-primary{font-size:12px!important;padding:7px 10px}.gw-stats{gap:8px}.gw-stat{padding:14px 10px;gap:8px}.gw-stat>svg{display:none}.gw-stat strong{font-size:24px}.gw-stat small{font-size:11px}.gw-team-grid{grid-template-columns:1fr}.gw-room-switch{flex-wrap:wrap}.gw-room-switch label{width:100%}.gw-room-switch select{flex:1}.gw-goal-card{padding:20px}.gw-goal-card h2{font-size:20px}.gw-section-heading{align-items:flex-start;flex-direction:column;gap:5px}.gw-review{padding:24px 18px 0}.gw-review-card{padding:18px}.gw-review-member>.gw-status{font-size:10px}.gw-creation-result{padding:32px 18px}.gw-creation-member{gap:10px;padding:10px}.gw-creation-member>.gw-text-btn{font-size:11px;padding:4px}.gw-creation-member>.gw-status{font-size:10px}.gw-inbox-item{padding:18px}.gw-recovery{flex-direction:column;align-items:flex-start}}
@media(max-width:470px){.gw-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-role-art{height:150px}.gw-role-art>.bt-mark{width:150px!important;height:150px!important}.gw-inspector{grid-template-columns:1fr}.gw-selection-summary{border:0;padding:0}.gw-wizard-footer>.gw-text-btn{font-size:12px;padding:4px}.gw-member-card>.bt-mark{width:64px!important;height:64px!important}.gw-task-board{grid-template-columns:1fr}.gw-page-head{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.gw-workspace,.gw-workspace[data-leaving]{animation:none}.gw-workspace button{transition:none}}
`
