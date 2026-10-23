# Accessible charts

What we applied, with the standards behind it. WCAG references are to WCAG 2.1 AA.

## Colour and contrast

- **Colour can't be the only cue** (WCAG 1.4.1). Tell lines apart by a direct text label and a dash pattern as well as colour. [W3C](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- **Lines and other graphics need 3:1 contrast** against the background (WCAG 1.4.11). [W3C](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- **Text needs 4.5:1** (WCAG 1.4.3), including small muted labels, which are the usual failure. Our dark green palette's muted grey-green measured about 5:1 and still read dim at small sizes, so we raised it to about 9:1.
- **Avoid red against green** for good/bad or up/down. We used two hues of different lightness (blue-ish for below normal, amber for above).
- **Decorative overlays lower contrast.** Scanline and vignette effects pushed grey text below 4.5:1, so they are off by default and never shown when the system asks for more contrast (`prefers-contrast: more`).

## Light and dark themes

- **Offer both, and follow the system until the reader chooses.** Set the theme from `prefers-color-scheme` in a small script in `<head>`, before the stylesheet paints, so the page never flashes the wrong theme. A saved choice wins; a later system change is still followed when nothing was saved.
- **Check every text colour in both themes,** on both the page and card backgrounds. When we made light versions of three dark palettes, each accent kept its hue and was darkened until it passed 4.5:1 on both.
- **Switch glows off on light backgrounds**; they blur rather than glow.
- **Charts should read colours from CSS variables,** so a theme change needs no redraw.

## Keyboard and screen readers

- **The chart itself is focusable** (`tabindex="0"`) with a descriptive `aria-label`: what it shows, the range, a summary of each line, and how to use the keys.
- **Arrow keys step through the data;** Home and End jump to the ends. A heatmap uses the grid pattern: arrows move between cells.
- **A polite live region** (`aria-live="polite"`) announces the value under the keyboard or pointer cursor, with all its context: "+6 H · right-wing 112 · control 86 · normal range 90 to 116".
- **Every chart has a "Show data as a table" disclosure** listing every number, with a header row. Build it when opened, so long tables cost nothing until needed.
- **Complex charts need two text alternatives:** a short one, plus a longer description or data table nearby. [W3C WAI tutorial](https://www.w3.org/WAI/tutorials/images/complex/)
- **Don't redraw under someone.** A live-updating page should skip a refresh while focus is inside the view, and offer a pause button.

## Phones and zoom

- **No horizontal page scroll** at 375 px wide. Check `document.documentElement.scrollWidth` against the viewport width.
- **Touch targets of at least 44 px** for navigation; 24 px minimum for small controls.
- **Raise the smallest text a step on phones** instead of scaling the whole page.
- **Fewer ticks, fewer days and shorter labels on narrow screens,** never overlapping text.
