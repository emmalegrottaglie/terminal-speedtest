# Chart recipes

Chart forms that worked for a before-and-after study of many time series, with the decisions behind them. All were drawn as SVG by hand-written JavaScript, with no chart library.

## 1. Event-aligned chart with a chance band

**Question:** around the moment of each event, did a group's activity fall outside its normal range, while the control group stayed inside it?

**Data:**
1. For each series, the ratio of each hour to the same weekday and hour 1 to 3 weeks earlier (at least 2 of the 3 weeks needed).
2. For each event time `t` and each offset `k` (−48 h to +48 h), take the ratio at `t + k`. Average over events, weighting each equally. Multiply by 100 for an index.
3. A group's curve is the median of its members' curves at each offset, using only offsets where at least 2 members have a value.
4. **Chance band:** draw random start times from before the first event (the whole window must end before it), as many as there are events, and build the same curve. Repeat 500 times. At each offset the band runs from the 5th to the 95th percentile. Below 50 possible start times, draw no band and say why.

**Visual:**
- X axis in hours from the event (−48 H … +48 H), a vertical rule at 0 labelled "EVENT".
- A reference line at 100 labelled "100 = NORMAL".
- The selected group in the highlight colour; the control group always drawn, dashed and muted.
- The band as a light tint of the group's colour, with its meaning in the caption.
- A group picker. The control line cannot be switched off.

**Decisions, made on the real data:**
- **Smoothing.** We measured the band's width at 1, 3 and 6-hour rolling means. Median width in index points for the main group: 28, 22 and 20; for a 3-member group: 86, 65 and 55. One hour was too noisy to show anything but very large changes, and 6 hours blurred the few-hour drop the claim described. We chose 3. **Smooth the band with the curve,** so smoothing never makes a result easier to get.
- **Span.** ±72 h gave the same picture as ±48 h and a smaller pool of random start times, so we kept ±48 h.
- **Overlapping events.** Two of our events were 24 h apart, so the hours after one include the next. The chart says so in a note.
- **Small groups.** A group of 3 had a band too wide to show anything. That is stated, not fixed by rescaling or extra smoothing.

**Tests that proved it:** a synthetic series that drops 40% for 12 h after each event must leave the band; flat noise must stay inside it for at least 90% of offsets.

## 2. Heatmap of many series

**Question:** is a change broad, or driven by a few series? Did the controls change too?

**Data:** each series' daily value as a percentage of its own pre-event average. Rows are series, grouped, each series appearing once. Columns are days.

**Colour bins, from the real spread.** The first draft used neutral 95–105, with bins up to ±30. On real data, half of all ordinary pre-event days fell outside 85–115 (5th percentile 47, 25th 74, median 93, 75th 112, 95th 167), so the draft would have coloured most of the map. The final bins are symmetric as ratios, so halving reads as far from normal as doubling:

| Index | Colour |
|---|---|
| below 50 | low colour, strong |
| 50–67 | low colour, mid |
| 67–80 | low colour, faint |
| 80–125 | neutral |
| 125–150 | high colour, faint |
| 150–200 | high colour, mid |
| above 200 | high colour, strong |

The end bins are open, so one tiny series swinging +400% does not stretch the scale for the rest. Tell readers how often the strongest bin happens on ordinary days ("before the strikes, about 1 in 20 days was below 50"), so a few dark cells aren't read as a finding.

**Lesson:** pick bins after looking at the distribution of ordinary periods, not before.

**Visual and behaviour:**
- Binned colours, not a continuous scale, so the legend can be read off exactly.
- Two hues for below and above normal, never red against green.
- Missing days hatched, never neutral; the legend shows hatching as "NO DATA".
- Event days marked above their column, with a thin dashed rule through it.
- Group heading rows between groups.
- Long names cut in the middle so a meaningful ending stays visible ("BSKY "Zelensk… en", not three identical "BSKY "Zelensky" …").
- Fewer days on phones (21 instead of 50).
- Hover and keyboard focus read one cell: "r/Conservative · 10-09 · index 78 (−22% vs pre-strike)".

## 3. Difference from control

**Question in one line:** is the group moving differently from the control?

- For each day, the group's index minus the control's index, in **percentage points**.
- Shade the 5th to 95th percentile of the daily difference over the pre-event period as the normal range. It is a description of ordinary days, not a significance test, and the caption says so. With fewer than 10 days of both series, no band and a note.
- A rule at 0 labelled "0 = NO DIFFERENCE"; ticks like "+20 PP".
- A day where either series is missing is a gap.

## 4. Images for sharing

Any chart can be downloaded as a PNG someone can post, with its context baked in.

- **The image is the chart plus a caption block:** title, caption, "Data to <date time> UTC", sources, and the site address as plain text.
- **Size:** 1200 × 675 (16:9, a common in-feed ratio), drawn at 2× for sharp text.
- **How:** serialise the SVG with its computed styles inlined, draw it to a canvas, then `canvas.toBlob`. Embed the font in the SVG as a data URI, or the canvas falls back to a system font. This is one reason every chart is SVG: an HTML-grid chart can't be exported this way.
- Use the viewer's current theme, but never include decorative overlays such as CRT scanlines.

## Generalising a line chart

One line-chart function drew every chart. Two options made it reusable beyond time series:
- **A non-time x axis**: pass a tick generator and a formatter for x values (used for "hours from event").
- **A band that varies along x**: pass lower and upper edges as point lists, drawn as one polygon per run where both edges exist. The data table gets "RANGE LOW" and "RANGE HIGH" columns, because the band is data too.

## Charts we decided not to make

- **A counter of "events that didn't happen".** It states the cause as fact.
- **A map of regional communities.** It suggests geography means something, and it didn't.
- **An hour-of-week heatmap.** It explains the baseline but answers no question about the event; at most an explainer.
