# Terminal Design System

A retro-futuristic terminal / broadcast-console look for web and mobile-web apps, extracted from the Weather Terminal app. Self-contained: no build step, no dependencies beyond Google Fonts.

## Contents

| File | Purpose |
|---|---|
| `DESIGN_GUIDE.md` | The rules — principles, palettes, colour roles, type scale, spacing, components, motion, copy voice, a speed-test screen blueprint, accessibility, do/don't. Read this first. |
| `terminal.css` | Drop-in stylesheet: theme tokens plus classes for every component. |
| `specimen.html` | A complete speed-test screen built only from the kit, with palette / accent / font switchers. All numbers on it are simulated. |
| `palettes.html` | Reference sheets for every palette in dark and light mode (hex, RGB, role and contrast per token, read live from `terminal.css`), plus a typeface sheet: JetBrains Mono (the default, used by the Bot Traffic Monitor), IBM Plex Mono and Space Mono, with their `data-font` values and weights. |
| `palettes/` | The same sheets as PNG images, for app icons and designs made outside the browser. |
| `research-dataviz/` | The research behind the chart rules (§11 of the guide), with a checklist for new charts. |
| `AGENTS.md`, `CLAUDE.md` | Maintenance instructions: design decisions made in any app are written into this system and synced to every copy. |
| `sync_copies.py` | Copies the canonical folder (in the bot tracker repo) over the other repos' copies. |

## Keeping it current

This folder is shared by the bot tracker (canonical copy), Weather Terminal and the retro speed test. Any design decision that adds or changes a rule goes into `DESIGN_GUIDE.md` in the canonical copy, then `python sync_copies.py` replaces the other copies. See `AGENTS.md`.

## Quick start

1. Copy this folder into your project (e.g. `design/terminal/`).
2. In your page's `<head>`:

   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=IBM+Plex+Mono:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap">
   <link rel="stylesheet" href="design/terminal/terminal.css">
   ```

3. Pick a theme on `<html>`:

   ```html
   <html data-palette="term-phosphor" data-accents="duotone" data-font="jetbrains">
   ```

   - `data-palette`: `term-phosphor` (default), `term-amber`, `term-navy`, `term-light`
   - `data-mode`: omit for dark, `light` for the palette's light version
   - `data-accents`: `uniform`, `duotone`, or omit for `broadcast`
   - `data-font`: `jetbrains` (default), `plex`, `space`

4. Build with the classes — open `specimen.html` in a browser and copy markup from it. It works straight from disk (`file://`).

## Palette images

`palettes/` holds one 1200 × 675 PNG per palette and mode, `type.png` for the typefaces, and `all-palettes.png` with all seven sheets. They are screenshots of `palettes.html`. After changing a colour in `terminal.css`, open `palettes.html?palette=term-amber&mode=light` (any palette and mode) in a browser and capture the `.sheet` element at 1200 × 675 to regenerate them; `palettes.html?sheet=type` gives the typeface sheet. All three fonts are on Google Fonts under the SIL Open Font License 1.1.

## Using it with Claude Code

Point the assistant at the guide in the new repo's `CLAUDE.md`, for example:

```markdown
UI must follow design/terminal/DESIGN_GUIDE.md and use design/terminal/terminal.css.
Label every number, never show fabricated data, keep border-radius 0.
```
