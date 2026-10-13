# ONTRACK app and UI audit

## Anything reference applied

The 11 supplied onboarding screenshots informed a functional UI pass: Today is the first home section, followed by upcoming work and plans; the planner is compact and its optional shortcuts are collapsed. Neutral surfaces replace the full-page cobalt glass treatment, while cobalt remains the action/selection accent. Labels, body copy, buttons and keyboard focus are more readable. The floating dock retains the existing destinations and uses labelled, larger targets. Empty accounts have an inline first-plan action. A three-step, skippable Quick tour demonstrates focus, weekly planning and reviewing a proposed plan. Authentication keeps its existing behaviour with simpler form styling.

The changes extend draft PR #19. Real account authentication, cloud sync and the separate legacy/dated calendar stores still require the previously noted follow-up. CI captures synthetic fixture screenshots for internal visual review.

Audited source baseline: `d815e566b3d9ba699bb6fb4e8280653bf40582b6`.

This is a source and build audit. The live browser timed out twice before returning page state. Visual appearance, real sign-in, cloud propagation and production planner configuration have not been verified. No account records were changed.

## Findings addressed

| Priority | Finding | Change |
| --- | --- | --- |
| High | Today reads saved focus without checking its date, so yesterday's actions can appear as today's. | Use the local calendar date to select the current focus, without deleting saved history. |
| High | Focus dialog changes and cloud updates do not refresh the Today list because the redesign only refreshes the greeting once mounted. | Refresh the life sections on local and unified state events, and on return to the app. Leave the composer mounted to preserve drafts. |
| Medium | Toggling focus rebuilds the entire workspace, clearing planner text and keyboard focus. | Refresh only the life sections and restore focus to the toggled control. |
| Medium | A missing or unknown sync state is shown as “Synced”. | Show “Checking sync” until an explicit status is available. |
| Medium | The planner input has only placeholder text and suppresses its focus outline. | Add an accessible name, required input validation, a visible focus boundary and button focus indicators. |
| Medium | Planner status updates and focus completion lack accessible state. | Add a polite status region, pressed state for focus controls, named plan dialogs and disabled submit state while planning. |
| Medium | All plans has no creation action, leaving empty accounts with no manual entry point from that sheet. | Add Create a plan, using the existing goal creation flow. |
| Medium | `npm ci` fails because the dependency lockfile omits the existing Supabase dependency. | Repair the lockfile and use reproducible installation in CI. |
| Medium | Planner requests can wait indefinitely and the preview mislabels a full calendar as no requested time. | Bound the network request to 45 seconds with retry copy; explain missing slots and partial scheduling. |
| Build dependency | npm audit flagged a high-severity denial-of-service advisory in source-map-js. | Update the transitive build dependency to the patched version. |

## Open findings

| Priority | Finding | Recommended follow-up |
| --- | --- | --- |
| High | `nextBlocks`, planner context, suggested slots and plan application use `oncheck-state-v1.blocks`. Week uses dated `oncheck-calendar-v2.blocks`. Those views can disagree and the planner can miss calendar conflicts. | Make dated calendar records the shared scheduling source; test creating, editing, applying and syncing schedules against existing records before migrating. |
| Medium | The upcoming list does not exclude today's elapsed blocks. | Filter by dated start/end times after unifying the calendar source. |
| Medium | Legacy settings copy still describes ONCHECK and device-local identity although cloud account layers exist. | Review the final layered settings UI and replace stale copy with actual account behavior. |
| Verification | Cobalt glass overrides are layered over older mobile/editor CSS. Readability, native select options, touch targets and landscape containment require rendered inspection. | Run the responsive regression suite and inspect representative phone, tablet and desktop views. |

## Verification

- Production TypeScript/Vite build passed.
- Three state regression tests passed: stale-day focus, current local-day focus and truthful sync labels.
- Clean dependency installation passed after lockfile repair.
- Added browser regressions for focus editing/draft preservation and first-plan creation. The first CI run passed 34/35 browser tests; the remaining failure was an ambiguous selector in the new first-plan test, corrected before rerunning CI. Local live-browser inspection remains unavailable.
- Sign-in, cross-device sync, real AI responses, uploaded media and the live deployment remain unverified.

The patch addresses the listed source defects. It is not a claim that the entire app or its production services passed a visual or end-to-end audit.
