## Why

Each expanded quota window currently uses three terminal lines, making the sidebar unnecessarily tall. Users also need a consistent choice between remaining allowance and consumed allowance without losing reset times or diagnostic information.

## What Changes

- Place the window label, active marker, and reset countdown together on the first line, with the percentage right-aligned and the progress bar beneath it.
- Remove `resets in` and `left` from compact window readings; retain full countdown precision such as `1h 8m` and `6d 16h`.
- Add a persisted global `Remaining`/`Used` presentation preference for the sidebar (including collapsed summaries) and details view, defaulting to `Remaining`.
- Switch percentages and bar fill together, while keeping warning colors tied to quota exhaustion rather than display direction.
- Provide a keyboard-accessible preference control and visible indication of the selected mode in details.
- Preserve existing status, diagnostic, expansion, hiding, and narrow-terminal behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `quota-visibility-and-diagnostics`: Specify compact window layout and a persistent, accessible remaining/used display mode shared by sidebar and details.

## Impact

- Presentation model and storage compatibility in `src/tui/model.ts` and `src/tui/index.tsx`.
- Shared formatting, bars, sidebar summaries, details copy, and preference interactions in `src/tui/format.ts`, `src/tui/views.tsx`, and `src/tui/keys.ts`.
- Formatting, model, rendering, and plugin integration tests; user-facing preference documentation.
- No new dependency, provider collection change, RPC/domain schema change, or polling change. The prompt footer remains unchanged and explicitly labeled as remaining; extending its display mode is outside this change.
