# Terminal Design System — Guide

The visual language of the WeatherTerminal app, packaged for reuse on the web: a retro-futuristic terminal/broadcast console. Everything in this folder is self-contained — copy it into a new project and link `terminal.css`.

| File | What it is |
|---|---|
| `terminal.css` | Drop-in tokens plus component classes. Values match the app one-for-one. |
| `specimen.html` | A complete speed-test screen built only from the kit, with live palette / accent / font switchers. Open it in a browser to see every component. |
| `DESIGN_GUIDE.md` | This document — the rules behind the values. |

---

## 1. Principles

1. **A console, not a skeuomorph.** Flat fills, 1px hairlines, monospace everything. No gradients on surfaces, no rounded corners (`border-radius: 0` everywhere), no drop shadows except the phosphor glow on accent text.
2. **Every number is labeled.** A value never appears without its unit and meaning next to it (`12` / `MS PING`). Charts carry their values on the bars and their axis under them. Tables get a header row. If a reader has to guess what a number is, the screen is wrong.
3. **Never fake data.** While real data is loading, show the boot sequence; if a value is unknown, show `—`. Illustrative numbers are only acceptable on specimen pages, and they must say so on screen.
4. **Three hues, three jobs.** `a1` chrome, `a2` data, `a3` highlights (see §3). The accent set decides how many of those hues are distinct — it must visibly change the screen.
5. **Uppercase, tracked labels.** All chrome text is uppercase with wide letter-spacing. Only prose paragraphs and the prompt command are sentence/lowercase.
6. **Stepped motion.** Motion is mechanical: stepped blinks, linear sweeps, line-by-line reveals. Nothing bounces or eases elastically. Every animation stops under `prefers-reduced-motion`.

---

## 2. Theme axes

Three independent attributes on `<html>`. All combinations are valid.

### Palette — `data-palette`

| Palette | Attribute | bg | card | ink | muted | a1 | a2 | a3 |
|---|---|---|---|---|---|---|---|---|
| Phosphor (default) | `term-phosphor` | `#050805` | `#0d120d` | `#c8ffd2` | `#5c8c68` | `#33ff66` | `#7fd8ff` | `#ffd84d` |
| Amber Console | `term-amber` | `#0a0805` | `#120e08` | `#ffe4b0` | `#9c7a48` | `#ffb020` | `#ff5a4f` | `#fff2b8` |
| Broadcast 8s | `term-navy` | `#0b1030` | `#111844` | `#eaf0ff` | `#8fa0d8` | `#ff3ea5` | `#22e0ff` | `#ffd84d` |
| Terminal Light | `term-light` | `#f1eee2` | `#e7e3d4` | `#14170f` | `#5a6050` | `#1a7030` | `#0a5f7d` | `#8f4e00` |

Each palette also defines `--term-line` (hairlines, ~18–24% of the accent) and `--term-faint` (row dividers and bar tracks, ~8–10%). Terminal Light is the accessibility escape hatch for bright rooms; it pulls the CRT texture back to 34%.

### Accent set — `data-accents`

| Set | Effect | Use |
|---|---|---|
| `uniform` | `a2` and `a3` collapse onto `a1` — a single-hue monochrome screen | Purist CRT look |
| `duotone` | `a3` collapses onto `a1` — chrome vs data split | Calmer, still structured |
| `broadcast` (default, no attribute) | All three distinct | Maximum information separation |

### Typeface — `data-font`

| Font | Attribute | Weights available |
|---|---|---|
| JetBrains Mono (default) | `jetbrains` | 400, 500, 700, 800 |
| IBM Plex Mono | `plex` | 400, 500, 700 (800 falls back to 700) |
| Space Mono | `space` | 400, 700 (500→400, 800→700) |

Load all three once (the `<link>` is at the top of `terminal.css`) so switching fonts is instant.

---

## 3. Colour roles

| Token | Role | Examples |
|---|---|---|
| `--a1` | **Chrome** | Header band fill, hero value, prompt line, active nav item, primary chip, primary button, LEDs, corner brackets, scope rings |
| `--a2` | **Data** | Section labels (`// CONNECTION`), chart bars, secondary table column, status line under the hero, tile sub-status |
| `--a3` | **Highlight** | Quality/confidence band, peak bar, delta column, highlighted tile values, warning toasts |
| `--term-ink` | Primary values | Tile values, table values, bar values |
| `--term-muted` | Labels | Tile labels, table keys, sub row, footer, axis labels, inactive nav |
| `--term-line` | Structure | Tile grid lines, sub-row rule, table header rule, ghost chip border |
| `--term-faint` | Quiet structure | Table row dividers, boot progress track |
| `--term-bg` | Ground | Page background; also the text colour on any `a1`/`a2`/`a3` fill |

**Rule of spread:** each role should own at least one large surface on every screen (a band, a chart, a bar). If a role only ever colours small text, switching accent sets will look like nothing happened — which is exactly the bug the app had before its roles were spread out.

**Meaning-bearing colours never re-palette.** If a colour encodes meaning (a pass/fail grade, an AQI band, a signal-quality scale), give it a fixed scale that does not follow the palette. The palette changes the frame, never the meaning.

---

## 4. Typography

All sizes in px. Letter-spacing in `em` (the app's absolute values divided by the font size).

| Role | Size / line | Weight | Tracking | Colour | Class |
|---|---|---|---|---|---|
| Header band | 12 | 800 | .22em | bg on a1 | `.band` |
| Sub row | 9 | 500 | .20em | muted | `.sub` |
| Prompt | 11 | 700 | .10em | a1 | `.prompt` |
| Hero value | 92 / 78 | 800 | −.055em | a1 + glow | `.hero-value` |
| Hero status | 16 | 800 | .26em | a2 | `.hero-status` |
| Hero meta | 10 | 500 | .18em | muted | `.hero-meta` |
| Section label | 10 | 800 | .30em | a2 | `.sect` |
| Tile value | 18 | 800 | 0 | ink (a3 when highlighted) | `.tile-value` |
| Tile label | 8 | 500 | .20em | muted | `.tile-label` |
| Chip | 9 | 800 | .16em | bg on fill | `.chip` |
| Table cell | 11 | 500 / 800 for values | .05em | per column | `.table td` |
| Table header | 8 | 800 | .15em | muted | `.table th` |
| Bar value / label | 9 / 8 | 700 / 500 | 0 / .06em | ink / muted | `.bar-value`, `.bar-label` |
| Footer | 9 | 500 | .20em | muted | `.end` |

Numbers use `font-variant-numeric: tabular-nums` so columns and live counters don't jitter.

---

## 5. Layout and spacing

- **Gutter:** 18px on both sides of every block (`--gutter`). Nothing touches the screen edge except full-bleed bands and table row dividers.
- **Vertical rhythm:** section label 15px above / 9px below; hero 10px top / 18px bottom; boxed rows (band, sub) 11px vertical padding.
- **Grids:** tile grids are 3 columns (2 for denser data), divided by 1px `--term-line` hairlines — no gaps, no card backgrounds.
- **Width:** designed for a phone column (~360–440px). On desktop, centre a single column rather than stretching; the specimen caps it at 440px.
- **Bottom nav** sits above the system gesture bar: pad it with `env(safe-area-inset-bottom)`. The app shipped a bug where the gesture pill overlapped the tab labels — don't repeat it.

---

## 6. Components

Each maps to one class family in `terminal.css`; see `specimen.html` for live markup.

| Component | Class | Anatomy and rules |
|---|---|---|
| **Header band** | `.band` | Solid `a1` bar: screen title left (`// SPEEDTEST`), live status right (`● LIVE`). One per screen, always first. |
| **Sub row** | `.sub` | Context line under the band: location/server left, source/state right. Hairline below. |
| **Prompt** | `.prompt` | `❯ command --flags ▮` with a stepped blinking cursor. States what the screen is doing, in lowercase CLI form. |
| **Hero readout** | `.hero`, `.hero-value`, `.hero-status`, `.hero-meta` | The one big number, its status in `a2`, one meta line. Unit is small and inline (`.hero-unit`). |
| **Section label** | `.sect` | `// TITLE` — the `//` is added by CSS. Include the unit in the label when a chart follows (`// DOWNLOAD · MBPS BY SECOND`). |
| **Chips** | `.chip`, `.two`, `.three`, `.ghost` | Short uppercase tags. Filled = active or categorical, ghost = passive. Filled and ghost share a 1px border so heights match. |
| **Tile grid** | `.tiles`, `.tile`, `.tile-value`, `.tile-label`, `.tile-sub`, `.hl` | Value over label, optional sub-status in `a2`. `.hl` puts the value in `a3` for the one or two tiles that matter most. |
| **Labeled bar chart** | `.bars`, `.bar`, `.bar-value`, `.bar-fill`, `.bar-label`, `.peak` | Value above every bar, axis label below. Scale bars across the series' own min–max with a 12% floor, so small swings stay visible. Mark the maximum with `.peak` (a3). Set height via `--pct`. |
| **Data table** | `.table`, `.t-key`, `.t-value`, `.t-data`, `.t-delta` | Always has a header row. Fixed-width key and value columns; `● data` in a2, `○ delta` in a3. Keep times in one format (`18:02`, `NOW`). |
| **Quality band** | `.qband`, `.qband-label`, `.qband-ticks`, `.qband-action` | Solid `a3` bar: score, tick glyph run (`|||||||·`, filled count ∝ score), trailing action (`WHY?>` opens an explanation). The app uses it for model confidence; use it for stability/quality. |
| **LED** | `.led`, `.led.off` | 9px square status light. On = filled + glow, off = hollow outline. Binary states only. |
| **Corner brackets** | `.brk` | L-shaped 13px corners on a framed element (scope, map, key figure). Framing only — never a full border. |
| **Radar scope** | `.scope`, `.scope-ring`, `.scope-sweep`, `.scope-center` | Three concentric rings, a 30° sweep rotating every 5.5s, a readout in the centre. Rings and sweep never block interaction. |
| **Boot sequence** | `.boot`, `.boot-line`, `.ok`, `.boot-bar`, `.boot-fill`, `.boot-pct` | Replaces spinners and skeletons. Lines reveal one at a time and gain `[ OK ]` when done; progress bar and `NN% — STEP` underneath. |
| **Toast** | `.toast` + `.led` | Card-coloured box, 1px border in the status hue, LED + uppercase message. Errors in `a3`. |
| **Primary action** | `.action` | Full-width outlined button in `a1`; fills on press. Label starts with a glyph (`▶ RUN TEST`). |
| **Footer** | `.end` | `END TRANSMISSION — HH:MM` left, data attribution right. Wraps rather than colliding on narrow screens. |
| **Bottom nav** | `.nav` | Uppercase 9px labels, active in `a1`, inactive muted, hairline on top, safe-area padding. |
| **CRT overlay** | `.crt` | Optional scanlines + vignette as a fixed, click-through layer. The WeatherTerminal Android app does not paint it yet; it is part of the token set, so use it if it suits the product. |

---

## 7. Motion

| Token | Value | Used by |
|---|---|---|
| `--cursor-blink` | 1.1s, `steps(1, end)` | Prompt cursor |
| `--sweep-duration` | 5.5s linear, infinite | Radar scope sweep |
| `--boot-step` | 120ms per character in the source design; the app reveals whole lines at ~360ms (3×) because that reads better on a phone | Boot sequence |

- Transitions on changing numbers are stepped (`steps(4–6)`), like a display refreshing, not smooth tweens.
- `prefers-reduced-motion: reduce` zeroes all three tokens: the cursor holds solid, the sweep stops, boot lines appear at once. The CSS does this automatically. Mirror it in any JavaScript timers (the specimen shows how).

---

## 8. Voice and copy

- Screen titles and section labels start with `//`: `// SPEEDTEST`, `// HISTORY`.
- Status uses a dot: `● LIVE`, `● TESTING`, `● IDLE`.
- The prompt reads like a real command: `❯ speedtest --run --server mad-01`.
- Completed steps end with `[ OK ]`.
- Units live in the label, in caps: `MS PING`, `MBPS DOWN`, `% PACKET LOSS`.
- The footer signs off: `END TRANSMISSION — 21:48`, with the data source on the right.
- Keep it terse and literal. No marketing adjectives inside the console chrome.

---

## 9. Speed test blueprint

How the kit maps onto a speed-test app:

| Speed-test element | Component |
|---|---|
| Screen header | `.band` — `// SPEEDTEST` / `● IDLE · TESTING · LIVE` |
| Server + ISP line | `.sub` |
| What's happening | `.prompt` — `speedtest --run --server <id>` |
| Test in progress | `.boot` — resolve server → latency → download → upload, each gaining `[ OK ]` |
| Live throughput while testing | `.scope` with the current Mbps in `.scope-center` |
| Final download speed | `.hero-value` (big), upload + ping in `.hero-meta`, verdict in `.hero-status` |
| Ping / jitter / loss / down / up / grade | `.tiles` — highlight ping and grade with `.hl` |
| Throughput over the test | `.bars` — one bar per second, Mbps on each, `1S…10S` under, peak marked |
| Connection stability | `.qband` — `STABILITY 92%`, `WHY?>` explains jitter and loss |
| Past results | `.table` — `TIME / DOWN / UP / PING`, newest first, `NOW` for the latest |
| Start button | `.action` — `▶ RUN TEST` |
| Connection type | `.chip` — `IPV4`, `WIFI 6`, `MULTI-STREAM` |
| Errors (server unreachable) | `.toast` with `.led` |
| Attribution | `.end` — measurement server / provider on the right |

A grade or speed-quality scale is meaning-bearing, so give it a fixed colour scale, as the app does for air quality (§3).

---

## 10. Accessibility

- Verify text contrast for each palette in your own components, especially muted text on the dark grounds and every accent on Terminal Light. Terminal Light exists for bright environments; offer it.
- Never rely on colour alone. The labeling rule (§1.2) and the `●`/`○` glyphs carry meaning without hue.
- Keyboard focus is a 1px `a1` outline (`:focus-visible`), never removed.
- Announce live results with `aria-live="polite"` (the specimen's boot section does).
- Honour reduced motion in JavaScript as well as CSS.

---

## 11. Do and don't

| Do | Don't |
|---|---|
| Put the value on the bar and the time under it | Ship an unlabeled sparkline or chart |
| Show the boot sequence until real data arrives | Invent placeholder numbers |
| Give each accent role a large surface | Use `a2`/`a3` only for tiny text |
| Keep one time format per screen | Mix `21`, `5 PM` and `17:00` |
| Use hairlines and brackets for structure | Add rounded cards, shadows or gradients |
| Keep labels uppercase with wide tracking | Use sentence-case chrome labels |
| Let footers wrap on narrow screens | Let two text runs collide |
| Pad the bottom nav for the gesture bar | Hard-code a nav height that ignores safe areas |
