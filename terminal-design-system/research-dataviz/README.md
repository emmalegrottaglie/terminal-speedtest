# Presenting study data: what we learned

Notes from building the Bot Traffic Monitor (October 2026): how to label charts, how to show study data honestly, which chart forms worked, and how to make them accessible. They are written to be copied into another project. Nothing here depends on this repo's code.

## Contents

| File | What it covers |
|---|---|
| [01-labels-axes-units.md](01-labels-axes-units.md) | Axis titles, units, index charts ("100 = normal"), ticks, line labels, event marks, y-axis range. Researched from style guides and one perception study. |
| [02-honest-presentation.md](02-honest-presentation.md) | Rules for showing study data without overstating it: baselines, controls, chance bands, gaps, partial periods, titles, and how a viral chart went wrong. |
| [03-chart-recipes.md](03-chart-recipes.md) | Chart forms that worked, with the decisions behind them: an event-aligned chart with a chance band, a heatmap of many series, a difference-from-control chart, and shareable images. |
| [04-accessibility.md](04-accessibility.md) | Contrast, colour, keyboard use, text alternatives, data tables, light and dark themes. |
| [05-checklist.md](05-checklist.md) | A one-page check to run before a chart goes public. |

## How much to trust these notes

- **Sources were read, not guessed.** Each external claim links to a page that was opened and read. Points resting on sources that could not be read are marked *unverified*.
- **Decisions were made on real data.** Where a value was chosen (smoothing, colour bins), the numbers that decided it are given, so another project can redo the test on its own data rather than copy the value.
- **This repo's own docs hold the full detail:** `docs/CHART-LABELS.md` (the labelling research), `docs/CHARTS.md` (chart specs and decisions), `docs/DATA.md` (data rules and the fix log), `docs/DROP-CLAIMS.md` (the case study of a misread chart).

## Using this in another repo

Copy the folder. If the other project uses Claude Code, point to it from that repo's `CLAUDE.md`, for example:

```markdown
Charts must follow RESEARCH-DATAVIZ/05-checklist.md. Background and sources are in the same folder.
```

The folder is called `RESEARCH-DATAVIZ` rather than `RESEARCH` because this repo already has a `research/` Python package, and Windows treats the two names as the same folder.
