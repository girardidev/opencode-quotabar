## 1. Presentation preference and formatting

- [x] 1.1 Extend presentation preferences with remaining/used display mode and a remaining fallback for missing or invalid persisted values; test legacy objects and preservation of existing preferences.
- [x] 1.2 Add mode-aware percentage derivation and compact reset formatting without changing canonical snapshots or footer formatting; test conversion before rounding, fractional values, 0/100 endpoints, unknown allowance, and missing/elapsed resets.

## 2. Compact quota rendering

- [x] 2.1 Recompose the shared window block with label, active star, muted reset countdown, right-aligned bare percentage, and meter beneath; retain existing typography and all surrounding sidebar/details information.
- [x] 2.2 Make meter fill follow the display mode while keeping colors tied to remaining quota; test matched text/fill and identical severity across modes.
- [x] 2.3 Apply the shared display mode to collapsed sidebar summaries without changing headline-window selection or its corresponding reset.
- [x] 2.4 Add rendering coverage for multi-window providers, active markers, two-line layout, narrow widths, long labels, unknown and pending resets, and unknown percentages; verify fields remain readable without truncation.

## 3. Global preference control

- [x] 3.1 Wire the effective persisted mode through sidebar and details and add a clickable details control labeled `Display: Remaining` or `Display: Used`, plus mode-aware explanatory copy.
- [x] 3.2 Add the details `u` keyboard action and hint, ensuring it works without provider rows and does not interfere with navigation, refresh, hide/show, or closing details.
- [x] 3.3 Add plugin integration coverage for immediate cross-surface updates without refresh, persisted mode after reopening/restart, legacy defaults, and existing save-error feedback.

## 4. Verification and documentation

- [x] 4.1 Verify stale, partial, loading, error, diagnostic, hidden/collapsed provider, and footer-without-current-row behavior remain intact in both modes.
- [x] 4.2 Document the compact layout, mode control/shortcut, remaining default, persistent scope across sidebar/details, and unchanged remaining-labeled footer.
- [x] 4.3 Run the project test and typecheck commands, inspect representative terminal renders at standard and narrow widths, and validate the OpenSpec change.
- [x] 4.4 Run `graphify update .` after implementation to refresh the project knowledge graph.
