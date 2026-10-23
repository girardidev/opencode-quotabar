## Context

`WindowBlock` in `src/tui/views.tsx` is shared by sidebar and details. It currently renders label/remaining percentage, a meter, and reset text on three lines. `SidebarRow` also formats a separate collapsed summary. Details has hardcoded remaining-mode explanatory copy. Presentation preferences are stored through the existing `preferences` store in `src/tui/index.tsx`; `Prefs` currently covers hidden rows and collapse state.

The approved direction preserves terminal typography, semantic theme colors, all current quota information, and existing provider interactions. It changes composition rather than shrinking text or moving data behind hover or details.

## Goals / Non-Goals

**Goals:**
- Render each ordinary expanded window in two terminal lines: label/reset/percentage, then meter.
- Offer one persisted display mode across all sidebar readings and details, with remaining as the backward-compatible default.
- Keep reset timing, active-window selection, uncertainty, and exhaustion severity independent of display direction.
- Preserve keyboard access and readable narrow-terminal fallbacks.

**Non-Goals:**
- Redesign provider cards, remove diagnostics, add per-provider modes, or change the prompt footer.
- Change collectors, canonical remaining values, RPC schemas, refresh scheduling, or exhaustion thresholds.
- Implement application code as part of proposal creation.

## Decisions

### 1. Recompose the shared window block

Use the existing shared block for both surfaces, preserving label and active star, placing the reset immediately after them with a middle-dot separator. Keep the percentage right-aligned and the reset muted. Remove `resets in` and `left` from these compact readings; do not substitute a `used` suffix in used mode.

```text
  ● Codex ▾
    5h · 1h 8m                   100%
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Weekly · 6d 4h                95%
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──
  ● Claude ▾
    Session ★ · 1h 4m             67%
    ━━━━━━━━━━━━━━━━━━━━━───────────
    Weekly · 6d 16h               97%
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─
```

Use full existing duration precision, not the largest-unit-only formatter used by collapsed summaries. Unknown deadlines retain `reset time unknown`; elapsed deadlines retain `reset pending refresh`. Neither case becomes a fabricated countdown or replenished allowance. When the text cannot fit, allow additional lines rather than dropping or truncating data; retain the existing no-bar behavior below its width threshold. The two-line target applies when the content fits and a numeric allowance exists.

Alternative rejected: putting reset next to the meter. The user explicitly preferred reset next to the window type. Reducing font size or hiding fields would not satisfy the brief.

### 2. Persist a single presentation mode

Extend `Prefs` with `displayMode`, accepting `remaining` and `used`. Resolve missing or invalid stored values to `remaining`, including old persisted objects that do not receive newly added default fields. Preserve existing hidden/closed/collapsed values when saving. Reuse existing storage-error reporting.

Expose a global `Display: Remaining` / `Display: Used` control in the details header area, clickable and switchable with `u` while details is open. Add it to the details keyboard hint. It operates even without provider rows and updates both surfaces immediately without fetching new data. Update the details explanatory sentence to reflect the effective mode. A separate settings dialog or per-provider preference would add unnecessary navigation or inconsistency.

### 3. Convert only at the presentation boundary

Keep provider snapshots canonical as remaining percentages. Derive displayed values from the unrounded number: remaining mode uses `remaining`; used mode uses `100 - remaining`. Apply the existing whole-percent precision policy after conversion, preserving `<1%` and avoiding rounding a non-endpoint value to a misleading endpoint. Derive bar fill from the same selected quantity, retaining existing bar bounding and rounding behavior. Undefined remains `unknown`, with no meter in either mode.

Pass the effective mode explicitly through formatting and meter/window rendering. Use the same mode in collapsed sidebar summaries, but keep headline-window selection based on the existing server-designated active window or lowest known remaining window. Switching modes must never select a different window.

Keep color selection based on canonical remaining allowance. Thus 10% remaining and 90% used have the same warning color. Do not invert severity thresholds with meter fill.

Alternative rejected: transforming snapshots or changing collectors, which would leak a presentation choice into collection semantics. Global replacement of `formatRemaining` is also inappropriate because the footer deliberately retains its current remaining-labeled behavior.

## Risks / Trade-offs

- [Bare percentages are ambiguous without context] → Show the effective mode explicitly in details and on its control; remaining remains the default.
- [Long labels or unknown reset messages exceed sidebar width] → Wrap or fall back to additional text lines without losing fields; test actual supported widths.
- [Shared block changes inadvertently affect details] → Treat the shared compact block in details as intentional; retain all surrounding metadata, diagnostic and refresh controls.
- [Old stored objects omit the new field] → Normalize reads rather than relying solely on initial defaults, and test legacy and invalid values.
- [Used-mode colors suggest low risk at high consumption] → Keep colors tied to remaining quota and verify both directions at identical readings.
- [Other surfaces still show remaining] → Keep the footer unchanged with its explicit `left` suffix; document that this preference covers sidebar and details only.

## Migration Plan

Ship an additive preference with a remaining fallback and no destructive storage migration. Existing users see the approved compact layout with their previous remaining interpretation. Switching modes changes only local presentation and survives reopening/restarting. Rollback restores the prior UI; the extra stored field can be ignored without affecting existing preferences or provider data.

## Open Questions

None blocking. The details control and `u` shortcut are proposed implementation choices; the approved behavior is one shared mode for sidebar and details.
