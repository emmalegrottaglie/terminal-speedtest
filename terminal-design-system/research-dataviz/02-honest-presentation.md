# Presenting study data honestly

Rules we arrived at while charting a contested claim: that drone strikes on Yandex data centres in October 2026 silenced Russian bot accounts. Most of them apply to any before-and-after study.

## The context is part of the chart

- **Draw what the claim is measured against.** Every chart that makes a claim also shows its comparison: a control group, the range of ordinary days, or both. A screenshot cropped to the chart alone must still carry that context.
- **Put the title, a one-line caption, the data date and the source inside the frame,** not only on the surrounding page. Charts get screenshotted and shared without their page.
- **Show the caption on the page too,** not only in an exported image: what was measured, how often, the time zone, the source.

## Baselines

- **One baseline, used everywhere.** "Index 100" always meant the same thing: the series' mean over one fixed pre-event period. If different charts used different baselines, numbers that look comparable would not be.
- **Compare like with like.** Activity has strong daily and weekly cycles. For "what changed after the event", compare each hour with the same weekday and hour 1 to 3 weeks earlier (needing at least 2 of the 3), not with yesterday or with the overall mean.
- **Name the baseline period by its dates** on the chart (see 01).

## Controls and chance

- **Include a control group.** We tracked non-political communities (hobbies, weather searches) alongside political ones. A drop that also shows in the control is probably not about politics. Ours mattered: after the strikes, the control group moved more than the group the claim was about.
- **Show what chance alone produces.** We drew the same curve from 500 randomly chosen pre-event start times, and shaded the 5th to 95th percentile at each point as a band. A real effect should leave that band; ordinary noise leaves it about 10% of the time. Seed the random draws so the band is reproducible.
- **Say how often "outside the band" happens by chance,** next to the count: "outside its normal range in 38 of 49 hours. On ordinary days that happens in about 10% of hours."
- **Count the tests.** With 80 series, about 4 will pass a p < 0.05 test by chance. Say so where the results are listed.
- **Check robustness.** Report whether a result holds across several window lengths and start offsets, not only the one that looks best.

## Gaps and partial periods

- **A gap is never a zero.** A failed or missing fetch is a break in the line or a hatched cell, never a value. Fill quiet hours with zero only inside a period that has data and only inside the range that was actually requested.
- **Detect source outages.** When a source returns zero for everything (Twitter's archive did, for 9 hours), check a query that is always busy. If even that is zero, the period is a gap, not a real zero.
- **Average only complete periods.** A daily mean needs a minimum of hourly values (we used 20 of 24). A partial day's mean reflects which hours were collected, not the day. This is why "today" never appears as a daily value.
- **Stamp every point consistently,** at the start or the end of the period it measures, across every source. Mixing the two put two of our sources an hour apart.
- **Exact counts replace estimates.** When an exact count arrives for a period that held an estimate, replace the estimate; averaging the two only adds noise.
- **Repair by re-fetching, never by patching.** Fix the code, then collect the affected stretch again from the source. Never delete or adjust stored values by a rule of thumb.

## Show everything, or say what was left out

- **No chart picks its members by how dramatic they look.** Group charts use every member; a heatmap lists every series, including ones with no data yet ("NO DATA YET").
- **Don't offer a sort by size of change** on a chart meant to show whether an effect is broad. It invites cherry-picking, and the grouped order already answers the question.
- **Set inclusion rules in advance and apply them.** Our keyword searches needed at least 20 posts a day; one that fell below on the full data was dropped from that platform, even though it had passed on a first sample taken during a news spike.
- **Every included item traces to a checked source.** If a keyword, event or claim is on a chart, say where it comes from, and check that source on the original page.

## Words and titles

- **Neutral titles while the effect is contested.** Style guides recommend titles that state the takeaway. We did not follow that, because a headline would state a conclusion the data didn't support.
- **Correlation is not cause.** Say so wherever a correlation is shown, and list the other explanations (news cycles, weekends, moderation, outages affecting real users).
- **Mark the strength of each event annotation:** "reported" (claimed in news or social media) or "confirmed" (corroborated independently), with its source and how its time was set. If a time is unknown, say how it was approximated ("starts at midnight UTC").
- **Don't build features that state the cause as fact,** such as a counter of "comments that didn't happen".
- **Label every number,** and show unknown values as "—", never as a guess.

## Case study: how a viral chart went wrong

In October 2026 a claim spread that the strikes had silenced Russian bots. Fact-checks (Lawfare, ZDFheute, Graphika, Cloudflare; see `docs/DROP-CLAIMS.md`) found these problems, each a rule above broken:

| What happened | Rule broken |
|---|---|
| A real chart of automated web traffic from Yandex's network (it fell 99%) was read as "bots on social media". The traffic was mostly Yandex's own search crawler. | Say exactly what is measured; a chart of one thing is not evidence about another. |
| An AfD "bot activity" chart, seen more than 4 million times, had uneven axes, no source, and data running four days past its posting date. The politician who posted it told ZDF he had no verifiable data. | Label axes, cite the source, date the data. |
| Claims of MAGA accounts "going quiet" rested on screenshots and how social media felt. Measurements found MAGA mentions on Twitter rose 25%. | Compare with a baseline and a control, not an impression. |
| Two different baselines ("0.4% of the two-week peak", "94% below late September") were quoted as if they were the same number. | One baseline, named by its dates. |
