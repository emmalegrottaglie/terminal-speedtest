# Terminal Design System — Guide

The visual language of the Weather Terminal app (Android, v1.0), packaged for reuse on the web: a retro-futuristic terminal/broadcast console. It is the one design system shared by Weather Terminal, the bot traffic tracker and the retro speed test; when one of them settles a new pattern, it is written down here and the folder is copied to the others. Everything in this folder is self-contained — copy it into a new project and link `terminal.css`.

| File | What it is |
|---|---|
| `terminal.css` | Drop-in tokens plus component classes. Values match the app one-for-one. |
| `specimen.html` | A complete speed-test screen built only from the kit, with live palette / accent / font switchers. Open it in a browser to see every component. |
| `DESIGN_GUIDE.md` | This document — the rules behind the values. |
| `AGENTS.md` | How to keep this system current: every design decision that touches a rule is written here and synced to every repo (`sync_copies.py`). `CLAUDE.md` imports it. |
| `palettes.html` | Reference sheets for every palette in dark and light mode, drawn live from `terminal.css`: hex, RGB, role and contrast for each token. |
| `palettes/*.png` | The same sheets as 1200 × 675 images (`phosphor-dark.png` … `navy-light.png`, and `all-palettes.png`), for icons, slides and other designs made outside the browser. |
| `research-dataviz/` | The research behind §11: labels and units, honest presentation, chart recipes, accessibility, and the checklist every chart goes through before it ships. |

---

## 1. Principles

1. **A console, not a skeuomorph.** Flat fills, 1px hairlines, monospace everything. No gradients on surfaces, no rounded corners (`border-radius: 0` everywhere), no drop shadows except the phosphor glow on accent text.
2. **Every number is labeled.** A value never appears without its unit and meaning next to it (`12` / `MS PING`). Charts carry their values on the bars and their axis under them, and say what they are (§11). Tables get a header row. If a reader has to guess what a number is, the screen is wrong.
3. **Never fake data.** While real data is loading, show the boot sequence; if a value is unknown, show `—`; if a whole module has no data, show the empty state (`NO DATA · TAP TO LOAD`). Status must be true too: don't show `● LIVE` on cached data, and show its age instead (`UPD 06:22`, `STALE 06:22`). Illustrative numbers are only acceptable on specimen pages, and they must say so on screen.
   - **Offline means the last real data, not sample data.** Keep the most recent successful fetch on the device and show it when a refresh fails, marked `STALE` with its fetch time (and date, if not today), with hours and days already past dropped so nothing old is labelled `NOW` or `TODAY`. Weather Terminal keeps it for 72 hours. With nothing saved, show the empty state.
   - **No defaults in place of values.** A missing reading is `—`, never a typical value (1015 hPa, UV 7, 50% humidity) or zero. A series ends where its data ends.
   - **No invented progress.** Show a percentage only when progress is measured (the speed test counts bytes). A fetch reports none, so its boot sequence shows steps and what is being fetched, without a bar or percentage.
   - **Scores need their inputs.** A score that compares sources (model agreement) needs at least two; with fewer, show `CONF —` and say why, rather than a perfect score.
   - **Indicators report real state.** A status light or toggle appears only for a setting that exists and works; don't light up features that can't be switched or aren't drawn.
4. **Three hues, three jobs.** `a1` chrome, `a2` data, `a3` highlights (see §3). The accent set decides how many of those hues are distinct — it must visibly change the screen.
5. **Uppercase, tracked labels.** All chrome text is uppercase with wide letter-spacing. Only prose paragraphs and the prompt command are sentence/lowercase.
6. **Stepped motion.** Motion is mechanical: stepped blinks, linear sweeps, line-by-line reveals. Nothing bounces or eases elastically. Every animation stops under `prefers-reduced-motion`.

---

## 2. Theme axes

Four independent attributes on `<html>`. All combinations are valid.

### Palette — `data-palette`

| Palette | Attribute | bg | card | ink | muted | a1 | a2 | a3 |
|---|---|---|---|---|---|---|---|---|
| Phosphor (default) | `term-phosphor` | `#050805` | `#0d120d` | `#c8ffd2` | `#5c8c68` | `#33ff66` | `#7fd8ff` | `#ffd84d` |
| Amber Console | `term-amber` | `#0a0805` | `#120e08` | `#ffe4b0` | `#9c7a48` | `#ffb020` | `#ff5a4f` | `#fff2b8` |
| Broadcast 8s | `term-navy` | `#0b1030` | `#111844` | `#eaf0ff` | `#8fa0d8` | `#ff3ea5` | `#22e0ff` | `#ffd84d` |
| Terminal Light | `term-light` | `#f1eee2` | `#e7e3d4` | `#14170f` | `#5a6050` | `#1a7030` | `#0a5f7d` | `#8f4e00` |

Each palette also defines `--term-line` (hairlines, ~18–24% of the accent) and `--term-faint` (row dividers and bar tracks, ~8–10%). Terminal Light is the accessibility escape hatch for bright rooms; it pulls the CRT texture back to 34%.

### Mode — `data-mode`

Every palette has a dark version (the default, no attribute) and a light version (`data-mode="light"`), so a site can offer one dark/light switch and keep the reader's palette. Phosphor's light version is Terminal Light; `term-light` remains as its older name.

| Palette, light | bg | card | ink | muted | a1 | a2 | a3 |
|---|---|---|---|---|---|---|---|
| Phosphor | `#f1eee2` | `#e7e3d4` | `#14170f` | `#5a6050` | `#1a7030` | `#0a5f7d` | `#8f4e00` |
| Amber Console | `#f6f0e3` | `#ece4d2` | `#1c140a` | `#6b5434` | `#8a4f00` | `#b0261c` | `#5e4a00` |
| Broadcast 8s | `#eef1fb` | `#e0e5f5` | `#0b1030` | `#4a5788` | `#a8115f` | `#006b85` | `#7d5a00` |

- Every text colour (ink, muted, a1 to a3) is at least 4.5:1 on both bg and card in light mode. The light accents keep their dark versions' hues, darkened until they pass.
- Light mode switches the glows off (they blur on a pale ground), pulls the CRT texture back to 34% and sets `color-scheme: light`.
- With no saved choice, follow the system: set `data-mode` from `prefers-color-scheme` in a small script in `<head>`, before the stylesheet paints, so the page never flashes the wrong mode.
- `palettes.html` and the PNGs in `palettes/` show every palette in both modes, with hex, RGB and contrast for each token.

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
| `--a2` | **Data** | Section labels (`// CONNECTION`), chart bars, range-list fills, secondary table column, status line under the hero, tile sub-status, per-item ratings, the right side of a callout |
| `--a3` | **Highlight** | Quality/confidence band, peak bar, peak row in a range list, delta column, highlighted tile values, the left (peak) side of a callout, `STALE` status, warning toasts |
| `--term-ink` | Primary values | Tile values, table values, bar values |
| `--term-muted` | Labels | Tile labels, table keys, sub row, footer, axis labels, inactive nav |
| `--term-line` | Structure | Tile grid lines, sub-row rule, table header rule, ghost chip border |
| `--term-faint` | Quiet structure | Table row dividers, boot progress track |
| `--term-bg` | Ground | Page background; also the text colour on any `a1`/`a2`/`a3` fill |

**Rule of spread:** each role should own at least one large surface on every screen (a band, a chart, a bar). If a role only ever colours small text, switching accent sets will look like nothing happened — which is exactly the bug the app had before its roles were spread out.

**Meaning-bearing colours never re-palette.** If a colour encodes meaning (a pass/fail grade, an AQI band, a signal-quality scale), give it a fixed scale that does not follow the palette (`.fixed-scale`, §6). The palette changes the frame, never the meaning. Ratings written out as words (`GOOD`, `FAIR`) can use `a2`, because the word carries the meaning.

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
- **Wide screens (600px / 600dp and up):** tablets, landscape and split screen get two columns rather than a stretched phone layout: the hero and its tiles on the left, the series (chart and table) on the right, divided by a 1px `term-line` hairline. A long table splits into two halves side by side, each with its own header row. Android ignores orientation locks on large screens, so every screen must work in landscape.
- **Fill a tablet with real data, not space.** When the wide layout leaves room, show more of the data you already have: more hours in a chart or table (Weather Terminal's Now shows 12 hours instead of 6, its hourly chart 24 instead of 12), an extra row of tiles for values the phone layout leaves to other screens, a words column beside a list (the daily list adds the condition), a chart spanning the full width with a bar per hour (Air's UV chart). Never pad with decoration or stretch elements to fill height.
- **Tablet type scale:** when the screen's shorter side is 600dp or more (a tablet, either way up), all text is 1.2× its phone size, with line heights and tracking scaled alike, and fixed column widths that hold text scale with it. Key the scale to the shorter side so a phone turned to landscape keeps phone type. Chart labels that still don't fit shrink to fit (down to 60%) rather than truncating to `1..`; so do table values such as a `+10°` difference.
- **Tables span the full width:** the key column on the left, numeric columns of equal width and right-aligned so digits line up and the table reaches the right gutter. Table text is the reading size (14–15px), not the label size.
- **Fill the screen with content, not chrome.** The quality band and the footer sit inline at the end of the content and scroll with it; never pin them over the content or leave a fixed gap above the nav.
- **Bottom nav** sits above the system gesture bar: pad it with `env(safe-area-inset-bottom)`. The app shipped a bug where the gesture pill overlapped the tab labels — don't repeat it. A line icon above each label is allowed (the app uses one per tab), in the same colour as its label. Labels are uppercase in the product's mono face.
- **Navigation has two places only:** the bottom nav for destinations, and band actions for everything else. No hamburger menu or side drawer: neither belongs to the console language, and the app removed its drawer.
- **Band actions** are line icons in the band's right slot (search, briefing, settings), drawn in `term-bg` on the `a1` band, 22px, about 18px apart, each with a touch target of at least 42px (pad with hit slop rather than growing the band). Each has an accessible name.
- **Secondary screens** (settings, about) open from a band action and replace the band's right slot with `✕ CLOSE`. Back and Close return to the screen they were opened from.
- **Responsive modules:** when a module can be resized (a home-screen widget, a dashboard panel), lay it out from its real size. Drop optional rows before anything truncates, in a fixed order, and let counts follow the space (more bars when wider, more rows when taller). Never cut a number or its label in half.

---

## 6. Components

Each maps to one class family in `terminal.css`; see `specimen.html` for live markup.

| Component | Class | Anatomy and rules |
|---|---|---|
| **Header band** | `.band` | Solid `a1` bar: screen title left (`// SPEEDTEST`), status right: data age (`UPD 06:22`), `● LIVE` only while something is genuinely streaming (a running test), or band actions (§5). One per screen, always first. |
| **Sub row** | `.sub` | Context line under the band: location/server left, source/state right. Hairline below. |
| **Prompt** | `.prompt` | `❯ command --flags ▮` with a stepped blinking cursor. States what the screen is doing, in lowercase CLI form. |
| **Hero readout** | `.hero`, `.hero-value`, `.hero-status`, `.hero-meta` | The one big number, its status in `a2`, one meta line. Unit is small and inline (`.hero-unit`). |
| **Section label** | `.sect` | `// TITLE` — the `//` is added by CSS. Include the unit in the label when a chart follows (`// DOWNLOAD · MBPS BY SECOND`). |
| **Chips** | `.chip`, `.two`, `.three`, `.ghost` | Short uppercase tags. Filled = active or categorical, ghost = passive. Filled and ghost share a 1px border so heights match. |
| **Tile grid** | `.tiles`, `.tile`, `.tile-value`, `.tile-label`, `.tile-sub`, `.hl` | Value over label, optional sub-status in `a2`. `.hl` puts the value in `a3` for the one or two tiles that matter most. |
| **Labeled bar chart** | `.bars`, `.bar`, `.bar-value`, `.bar-fill`, `.bar-label`, `.peak`, `.bar.gap`, `.bar-ref`, `.bars-caption` | Value above every bar, axis label below. Bars start at zero, except for quantities without a meaningful zero such as temperature, which start just under the series' low with a minimum span (§11). Compute the scale from the whole series, not the visible slice. A missing value is `.bar.gap`: `—` above an empty track, never a zero bar. Mark the maximum with `.peak` (a3). Set height via `--pct`; an optional dashed reference line via `.bar-ref` and `--ref`. A `.bars-caption` line under the axis names the baseline and any line (`BARS FROM 13° · 24 H SCALE`). |
| **Data table** | `.table`, `.t-key`, `.t-value`, `.t-data`, `.t-delta` | Always has a header row. Fixed-width key and value columns; `● data` in a2, `○ delta` in a3. Keep times in one format (`18:02`, `NOW`). |
| **Quality band** | `.qband`, `.qband-label`, `.qband-ticks`, `.qband-action` | Solid `a3` bar: score, tick glyph run (`|||||||·`, filled count ∝ score), trailing action (`WHY?>` opens an explanation titled by what is measured, e.g. `MODEL AGREEMENT`). The app uses it for model confidence; use it for stability/quality. With too few inputs to score, show `CONF —` and an empty tick run. A score over a range (the 10-day outlook) is computed from the data, e.g. the weakest day, and its footer names where it changes (`MODELS DIVERGE FROM THU`, or `MODELS AGREE ALL 10 DAYS`); never a fixed offset or a fixed sentence. |
| **LED** | `.led`, `.led.off` | 9px square status light. On = filled + glow, off = hollow outline. Binary states only. |
| **Corner brackets** | `.brk` | L-shaped 13px corners on a framed element (scope, map, key figure). Framing only — never a full border. |
| **Radar scope** | `.scope`, `.scope-ring`, `.scope-sweep`, `.scope-center` | Three concentric rings, a 30° sweep rotating every 5.5s, a readout in the centre. Rings and sweep never block interaction. |
| **Boot sequence** | `.boot`, `.boot-line`, `.ok`, `.boot-bar`, `.boot-fill`, `.boot-pct` | Replaces spinners and skeletons. Lines reveal one at a time and gain `[ OK ]` when done; underneath, one line saying what is being fetched (`FETCHING 4 FORECAST MODELS`). Add the progress bar and `NN% — STEP` only when progress is actually measured (§1.3). |
| **Toast** | `.toast` + `.led` | Card-coloured box, 1px border in the status hue, LED + uppercase message. Errors in `a3`. |
| **Primary action** | `.action` | Full-width outlined button in `a1`; fills on press. Label starts with a glyph (`▶ RUN TEST`). |
| **Footer** | `.end` | `END TRANSMISSION — HH:MM` left, data attribution right. Wraps rather than colliding on narrow screens. |
| **Data age** | `.upd`, `.upd.stale` | In the band's right slot when data comes from a cache or a schedule: `UPD 06:22`, switching to `STALE 06:22` (in `a3`) once older than the product's freshness window (the app uses 45 minutes). The time is when the data was fetched, never the current clock. Narrow modules may drop the `UPD` word and keep the time. Data from an earlier day carries its date: `STALE 22 OCT 07:11`. |
| **Callout** | `.callout`, `.callout-peak`, `.callout-data` | One line above a chart naming its extremes: `PEAK 23° AT 14:00` in `a3` left, `RAIN MAX 30% AT 03:00` (or `NO RAIN EXPECTED`) in `a2` right. Wraps to two lines rather than truncating. |
| **Range list** | `.ranges`, `.range-row`, `.range-track`, `.range-fill`, `.peak` | Header row, then key / category / low / bar / high / data. Every bar is positioned on the whole list's min–max (set `--from` / `--to`), so a narrow range never draws like a wide one. Mark the extreme row with `.peak`. On narrow screens drop the category column, then the bar; keep low, high and data. |
| **Fixed meaning scale** | `.fixed-scale`, `.fixed-scale-labels` | Five segments in fixed colours (`--scale-1…5`), the active one at full strength, the rest at 24%, labels underneath. Pair it with the rating word in the hero status and one plain-language advice line in the hero meta (`ENJOY USUAL OUTDOOR ACTIVITIES`). Per-item ratings go in each tile's sub-status. |
| **Channel selector** | `.channels` + `.chip[aria-pressed]` | Segmented row of chips that switches what a map or chart shows (`RAIN TEMP WIND CLOUD PRESS`). Active = filled `a1`, the rest ghost with muted text. Exactly one active. |
| **Empty state** | `.nodata` | For a whole module or screen with no data (the fetch failed and nothing was saved): one centred line saying what to do (`NO DATA · TAP TO LOAD`); tapping it retries. An optional muted second line can say why (`NO SAVED UPDATE ON THIS DEVICE YET`). Never fill the module with sample numbers. |
| **Bottom nav** | `.nav` | Uppercase 9px labels, active in `a1`, inactive muted, hairline on top, safe-area padding. |
| **CRT overlay** | `.crt` | Optional scanlines + vignette as a fixed, click-through layer. The Weather Terminal Android app does not paint it yet; it is part of the token set, so use it if it suits the product. |

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
- Status uses a dot: `● LIVE`, `● TESTING`, `● IDLE`. Data from a cache or schedule shows its age instead: `UPD 06:22`, `STALE 06:22`.
- The prompt reads like a real command: `❯ speedtest --run --server mad-01`.
- Completed steps end with `[ OK ]`.
- Units live in the label, in caps: `MS PING`, `MBPS DOWN`, `% PACKET LOSS`.
- The footer signs off: `END TRANSMISSION — 21:48`, with the data source on the right.
- Times are 24-hour `HH:MM`, and the current slot is `NOW`. A chart axis may shorten to the hour (`14`) when a table or callout on the same screen gives the full `14:00`; never mix 12- and 24-hour time.
- Unknown single value: `—`. Whole module without data: `NO DATA · TAP TO LOAD`.
- Coordinates use hemisphere letters, never a minus sign: `41.39°N 2.16°E`, `33.87°S 151.21°E`.
- Name the source of a map or model view truthfully (`ECMWF MODEL`); a forecast layer is not `LIVE`.
- Chart captions are one short line naming the baseline and any line or band: `BARS FROM 0 · DASHED LINE = UV 3, SUN PROTECTION NEEDED`. Put the value unit in the section label (`// TEMP °C · NEXT 12 H`) and short units on the values (`%`, `°`).
- Spell a unit the same way everywhere in a product, in caps in labels (`µG/M³`, `KM/H`), and use the same name for the same thing on every surface (not `CONF` in one place and `CONFIDENCE` in another).
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

- Text needs 4.5:1 against its ground and chart lines and fills 3:1, in every palette and in both modes. Small muted labels are the usual failure; the bot tracker raised its muted text to about 9:1 because 5:1 still read dim at 9px. Light mode exists for bright environments; offer it, and follow the system setting until the reader chooses.
- Decorative overlays (CRT scanlines, vignette, glow) lower contrast: keep them off by default, never show them under `prefers-contrast: more`, and switch glows off in light mode.
- Never rely on colour alone. The labeling rule (§1.2) and the `●`/`○` glyphs carry meaning without hue. Never use red against green for good/bad or up/down.
- Every chart has a text alternative: an accessible name saying what it shows plus every value (the app reads `Temperature, next 6 hours, degrees Celsius. NOW 14°, 08 14°, …`), or a data table nearby. See §11.
- Keyboard focus is a 1px `a1` outline (`:focus-visible`), never removed.
- Announce live results with `aria-live="polite"` (the specimen's boot section does).
- Honour reduced motion in JavaScript as well as CSS.

---

## 11. Charts and data visualisation

Rules for every chart in every product: the bar charts and range lists in Weather Terminal, the line, band and heatmap charts in the bot tracker, the per-second bars in the speed test. They come from the research in `research-dataviz/`; run its checklist (`05-checklist.md`) before a new chart ships.

### Say what it is

- **Title and unit.** The section label above a chart names what it shows and its unit (`// TEMP °C · NEXT 12 H`, `// DOWNLOAD · MBPS BY SECOND`). Short units also go on the values or ticks (`%`, `°`, `/ H`). A time axis needs no title; a value axis does.
- **Label directly.** Values sit on the bars; lines are labelled at their ends, not only in a legend. 2–8 axis labels, never rotated; on narrow screens, fewer ticks and shorter labels rather than overlapping text.
- **Caption the baseline.** One muted line under the axis says where bars start and what any line or band means (`BARS FROM 13° · 24 H SCALE`, `DASHED LINE = UV 3, SUN PROTECTION NEEDED`, `90% OF PRE-EVENT DAYS FELL HERE`).
- **Name reference lines.** A dashed rule for a threshold or baseline gets its meaning in words: in the caption, or as a short label on the line (`100 = NORMAL`, `EVENT`).
- **Date and source in the frame.** The screen shows when the data was fetched (data age in the band) and where it came from (the footer). A chart exported as an image carries its title, caption, data time and source inside the image.

### Don't overstate

- **Bars start at zero** for any quantity with a true zero: counts, rain chance, UV, speed, pollutant concentrations.
- **Temperature is the stated exception.** 0 °C is not "no temperature", so a bar from zero would mostly show the distance from freezing. Weather Terminal starts temperature bars one degree under the series' low and spans at least 8°, so a 1° wobble draws as a small change instead of filling the chart; the caption names the start (`BARS FROM 13°`). Don't use a min–max scale with no minimum span: it turns any change into a dramatic one.
- **One scale per series.** Compute the scale from the whole fetched series, not the visible slice, so two charts of the same data (the app's 6-hour and 24-hour charts, a widget and the app) draw the same value at the same height, and zooming or paging never rescales the y axis.
- **Positions, not lengths, for ranges.** A range list positions each bar on the whole list's min–max (§6), so a 5° day never draws like a 15° one.
- **Draw the comparison.** When a chart claims something is unusual, show the normal range (a band) or a control series next to it, and say in words what the band is. Choose smoothing, bins and windows on ordinary periods and apply them equally to the comparison.
- **Neutral wording.** Titles describe what is plotted, not a conclusion; correlation is never described as cause.

### Missing data

- **A gap is never a zero.** A missing hour is `—` above an empty slot in its place; later bars don't shift left to close the gap. Lines break at gaps; heatmap cells are hatched and the legend shows hatching as `NO DATA`.
- **Series end where the data ends.** Don't pad a forecast with the current value or a default; stop the list or show `—`.
- **Unknown, not good.** A missing index is not rated: no data is never shown as `GOOD`, `0%` or `NO RAIN EXPECTED`.

### Colour

- `a2` for data, `a3` for the peak or the one highlighted series, a muted dashed line for controls and references (§3). A meaning-bearing scale uses fixed colours (§3).
- Two series are told apart by a direct label and a dash pattern as well as colour. Below/above-normal scales use two hues of different lightness, never red against green.
- Bins for a binned scale are chosen from the spread of ordinary periods, symmetric as ratios (halving reads as far from normal as doubling), with open end bins.

### Accessibility

- Every chart has an accessible name saying what it shows, its range or unit, and every value; long series also get a data table (`Show data as a table`) or a table nearby, as Weather Terminal's hourly table sits under its chart.
- Interactive charts are focusable; arrow keys step through the points, Home/End jump to the ends, and a polite live region reads the point under the cursor with its context.
- Contrast and motion as §10. Don't redraw a live chart while focus is inside it.

### Recipes

| Recipe | Product | Use it for |
|---|---|---|
| Labeled bar chart (§6) | Weather Terminal, speed test | A short series of single values: hourly temperature, UV by hour, Mbps per second. |
| Range list (§6) | Weather Terminal | Daily low–high ranges on one shared axis. |
| Line chart with a normal band | Bot tracker | A long time series against its own normal range; the band is data and appears in the data table as `RANGE LOW` / `RANGE HIGH`. |
| Event-aligned chart | Bot tracker | Activity before and after events, with a chance band from random start times. See `research-dataviz/03-chart-recipes.md`. |
| Heatmap of many series | Bot tracker | Whether a change is broad or driven by a few series; binned colours, hatched gaps. |
| Difference from control | Bot tracker | One line in percentage points, `0 = NO DIFFERENCE`, with the normal range shaded. |

---

## 12. Home-screen widgets (native)

Weather Terminal ships six Android home-screen widgets. They aren't built from `terminal.css` (Android renders widgets natively), but they follow the same rules, and the same anatomy works for any compact module: a dashboard tile, a notification or a watch face.

| Part | Rule |
|---|---|
| Frame | `term-bg` fill, 1px `term-line` border. Launchers round widget corners and apps can't stop them, so the corner brackets sit on the two bottom corners only, inset ~7dp so the curve doesn't clip them. |
| Band | Solid `a1`, `■` square, title left (place, or what the module shows), data age right (`UPD 06:22`; just `06:22` when narrow). |
| Values | Label over value in a hairline cell (the reverse of the app's tiles, because small text reads first at widget size). A row of cells shares its width by what each label or value needs. Widgets can't shrink text to fit, so the layout measures it (the mono faces advance 0.6 em, CJK glyphs 1 em, times the device's font scale) and switches to a roomier arrangement (four cells in a row become 2×2) when the text doesn't fit. |
| Bars | As the labelled bar chart, plus a second axis row with the rain chance under each hour, in `a2`. Bar count follows width, at roughly one bar per 34dp. Same scale rule as the app (§11), computed from the whole fetched day, so a widget and the app draw the same hour at the same height. |
| Footer | Legend left (`TEMP °C · HOUR · RAIN %`), where a tap goes right (`OPEN HOURLY ❯`, just `❯` when narrow or when a translated legend needs the room). |
| Sizes | Every widget resizes; layout is computed from the real size, so optional rows drop instead of text truncating (§5). |
| Theme | Follows the app's palette, accent set, typeface and language (§13), and repaints when they change. No motion: widgets can't animate. |
| Data | Never placeholder numbers. No data gives `NO DATA · TAP TO LOAD`; data older than ~6 hours is dropped rather than shown. |

---

## 13. Languages

Weather Terminal ships in English, Spanish, Brazilian Portuguese, French, German, Japanese, Korean and Traditional Chinese. These rules apply to any product that translates its interface; the bot tracker and the speed test are English-only for now.

### Strings

- **Every visible string comes from a dictionary**, one per language, typed against the English one so a missing key fails the build. That includes accessible names, toasts, chart captions and widget text, not only screen copy. Store data as keys (a condition is `partlyCloudy`, a day is a date) and translate when drawing, so a language change never needs a refetch.
- **Write chrome labels in capitals in the dictionary** for Latin scripts (`HEUTE`, `MAÑANA`), rather than upper-casing in code: a few languages need a different capital form, and sentences (the briefing, advice lines) stay in sentence case. Japanese, Korean and Chinese have no case; leave them as written.
- **Units, symbols and names don't translate.** `°C`, `KM/H`, `HPA`, `µG/M³`, `PM2.5`, `UV`, model names (`ECMWF`), palette and typeface names, and the prompt line (`❯ weather --now`) stay as they are. Coordinates keep their hemisphere letters.
- **Numbers follow the language's decimal separator** (`0,0 MM` in German, French, Spanish and Portuguese); times stay 24-hour `HH:MM` everywhere (§8).
- **The current slot is the language's word for now** (`JETZT`, `AHORA`, `MAINT.`, `現在`), and each language has a short form for narrow columns (`todayShort`, `tomorrowShort`), as English has `TMRW`.
- **Place names come from the source in the reader's language** when the source offers it (the geocoder takes a language), and stay as the user saved them otherwise.

### Type

- **CJK tracking is a quarter of the Latin tracking.** The console's wide letter-spacing reads well on Latin capitals but pulls Japanese, Korean and Chinese characters apart; multiply every tracking value by 0.25 for those languages, on screens and widgets alike.
- **CJK falls back to the system font.** None of the three mono faces has CJK glyphs; Android draws them with the system font at the same size and weight. Latin text in a CJK screen (numbers, units, `PM2.5`) keeps the mono face. A CJK glyph is about one em wide against the mono faces' 0.6 em, so layouts that measure text count it double.

### Layout

- **Design for German.** German labels run 30–60% longer than English, and French a little less. A layout is done when the German screens hold, not the English ones.
- **Rows wrap, column heads shrink, nothing cuts a word.** A row of chips wraps to a second line. A column head or a section label that doesn't fit on one line shrinks (down to 70%) rather than wrapping or truncating. A label allowed two lines breaks at a space or a hyphen, never mid-word: Android ignores soft hyphens, so a long compound gets a real hyphen with a zero-width space after it (`REGEN-` / `RISIKO`). Keep a unit whole with a word joiner after its slash (`µG/⁠M³`), so a long name wraps before the unit instead of inside it. Prefer a shorter real word to an abbreviation (`AUFGANG` for sunrise under a sun glyph, not `SONNENAUFG.`).
- **A value never truncates because its label is long.** Cells in a row share space by what their label or value needs, not equally and not by the label alone.
- **Translations are checked on a device**, every language on the phone and the tablet, before they ship. A translated string that doesn't fit is fixed in the layout first and in the wording second.

### Choosing the language

- **Follow the device, with an override.** The product starts in the device's language (falling back to English), and Settings offers `AUTO` plus every language written in its own name and script (`DEUTSCH`, `日本語`, `繁體中文`), never translated into the current language. The choice persists, and widgets and other surfaces follow it.
- **Chinese is Traditional only** for now, so a Simplified Chinese device gets Traditional. Spanish is neutral Latin American and Portuguese is Brazilian; other regional variants get those.
- **Store listings are translated too**; legal pages (privacy policy) may stay in English.

---

## 14. Do and don't

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
| Show data age (`UPD 06:22`) on cached data | Label cached or stale data `● LIVE` |
| Drop whole optional rows when space runs out | Truncate a number or its label |
| Give a meaning scale fixed colours | Recolour AQI or grade bands with the palette |
| Start bars at zero, or name the baseline in a caption | Stretch a 2° change to fill the chart |
| Show a missing value as `—` and an empty slot | Draw a missing value as zero, or close the gap |
| Put actions in the band or the bottom nav | Add a hamburger menu or side drawer |
| Split into two columns at 600dp and up | Stretch the phone layout across a tablet |
| Fill extra tablet space with more of the real data | Leave half a tablet screen empty, or pad it with decoration |
| Show the last real fetch offline, marked `STALE` with its time | Show a sample city or default numbers when offline |
| Show a percentage only for measured progress | Show a fixed `70%` while a request is in flight |
| Write a design decision into this guide and sync every copy | Leave the guide describing what the apps no longer do |
| Keep every visible string in a dictionary, data as keys | Hard-code English in a component, or store translated text |
| Check German, Japanese and one Romance language on a device | Ship a translation checked only in English |
| Let chips wrap and column heads shrink to fit | Truncate `MORG…` or break `REGENRI` / `SIKO` mid-word |
| Quarter the tracking for Japanese, Korean and Chinese | Space CJK characters as widely as Latin capitals |
| Name each language in its own script in the picker | Translate language names into the current language |
