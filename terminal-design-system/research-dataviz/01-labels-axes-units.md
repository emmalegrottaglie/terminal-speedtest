# Labels, axes and units

Researched in October 2026 after feedback that a chart's y axis was not clearly labelled. A research agent ran 14 web searches and read 13 pages; only pages actually read are cited. Some sources could not be read: the Urban Institute style guide, the FT Visual Vocabulary, Our World in Data's chart documentation, Schwabish's *Better Data Visualizations*, Stephen Few's essay on dual axes, and a chapter on uncertainty by Padilla, Kay and Hullman. Points resting only on those are marked *unverified*.

## Axis titles and units

- **Say what the numbers are, next to the numbers.**
  - The EU Data Visualisation Guide calls axis labels indispensable unless enough points are labelled directly, and suggests 2 to 8 labels on a numeric axis. [data.europa.eu](https://data.europa.eu/apps/data-visualisation-guide/axes-grids-and-legends)
  - Datawrapper leaves out axis titles on most charts. It puts the measure in the title or description and the unit on the tick numbers (for example "%"), and uses a short text annotation as the axis label where needed. [Datawrapper Academy](https://www.datawrapper.de/academy/why-datawrapper-does-not-include-axis-labels-for-many-charts)
  - The UK Government Analysis Function puts the unit in the chart title or at the top of the value axis, and keeps all text horizontal. [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-chart-examples)
- **A time axis needs no title; a value axis does.** No source asks for both.
- **Never rotate text.** Put the value-axis title in small capitals above the top-left of the plot.
- **Put short units on the ticks:** "%", "+20 PP", "/ H".

What we built: a one-line axis title on every chart ("% OF PRE-STRIKE AVERAGE", "PERCENTAGE POINTS · GROUP MINUS CONTROL", "POSTS / H"), plus units on the ticks where they are short.

## Index charts ("100 = normal")

- **Name the base period by its dates.** The US Bureau of Labor Statistics labels an index by its base period, for example "1982–84 = 100". [BLS Handbook of Methods](https://www.bls.gov/opub/hom/topic/index-number-formulae.htm) We wrote "100 = AVERAGE 09-15 TO 10-07", read from configuration, not hard-coded.
- **Describe changes in percent,** not index points: 110 is 10% above the base. Show both in readouts ("147, +47% vs pre-strike") so nobody has to do the arithmetic.
- **Draw the reference line in grey, behind the data, and label it.** [Datawrapper Academy](https://www.datawrapper.de/academy/what-to-consider-when-creating-line-charts)
- **Index instead of using two y axes.** Indexing each series to its own base is the usual alternative to dual axes (Few, *unverified*). With two axes, whoever draws the chart decides where the lines cross.
- **Percent and percentage points are different units.** The gap between two percentages is in percentage points, and the axis must say so.

## Ticks

- 2 to 8 labels on a numeric axis (EU guide). We use about 5, and on index charts 100 is always one of them.
- Choose a "nice" step (1, 2, 2.5 or 5 times a power of ten) and give tick labels only the decimals the step needs: 0, 25, 50, not 0.00, 25.0, 50.0.
- Size the left margin to the widest tick label so long labels are not clipped.
- On phones, use fewer x ticks and drop end labels that would run off the edge (we used every 24 h instead of every 12 h below 480 px wide).

## Lines, events, titles

- **Label lines directly** at their right-hand end instead of using a legend. Legends make the eye travel, and fail in greyscale and for colour-blind readers. [EU guide](https://data.europa.eu/apps/data-visualisation-guide/direct-labelling)
- **Mark events with dashed vertical lines and short labels.** Put longer text in a note. [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-chart-examples) When markers are closer than one label's width, merge their labels ("SASOVO · KALUGA") rather than overlap them.
- **Title, subtitle, source.** The Analysis Function pairs a headline title with a subtitle giving the measure, place and dates, plus a source line naming who owns the data.
- **Labels over data need a halo** (a background-coloured outline) so they stay readable where a line passes under them.

## Y-axis range

- **Starting above zero exaggerates change.** Correll, Bertini and Franconeri (CHI 2020) found that a y axis starting above zero made people see bigger effects, for line charts as well as bars, and warning cues such as broken axes did not remove the effect. [arXiv 1907.02035](https://arxiv.org/abs/1907.02035)
- **There is no universal rule.** Datawrapper says line charts need not start at zero but should include it when values are near it. [Datawrapper blog](https://www.datawrapper.de/blog/line-charts) Match the scale to the size of effect you mean to show.
- **Fix the value axis to the whole period.** When a chart zooms or pans in time, keep the y range of the full period, so zooming in never makes a change look bigger.
- We start every value axis at zero.

## Uncertainty bands

- **Bands are misread.** People tend to read overlapping bands and error bars as real differences (Padilla, Kay and Hullman, *unverified*). A band needs words that say what it is, on the chart: "90% OF PRE-STRIKE DAYS FELL HERE", not "NORMAL RANGE".
