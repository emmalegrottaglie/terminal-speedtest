# Terminal Design System

A retro-futuristic terminal / broadcast-console look for web and mobile-web apps, extracted from the WeatherTerminal app. Self-contained: no build step, no dependencies beyond Google Fonts.

## Contents

| File | Purpose |
|---|---|
| `DESIGN_GUIDE.md` | The rules — principles, palettes, colour roles, type scale, spacing, components, motion, copy voice, a speed-test screen blueprint, accessibility, do/don't. Read this first. |
| `terminal.css` | Drop-in stylesheet: theme tokens plus classes for every component. |
| `specimen.html` | A complete speed-test screen built only from the kit, with palette / accent / font switchers. All numbers on it are simulated. |

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
   - `data-accents`: `uniform`, `duotone`, or omit for `broadcast`
   - `data-font`: `jetbrains` (default), `plex`, `space`

4. Build with the classes — open `specimen.html` in a browser and copy markup from it. It works straight from disk (`file://`).

## Using it with Claude Code

Point the assistant at the guide in the new repo's `CLAUDE.md`, for example:

```markdown
UI must follow design/terminal/DESIGN_GUIDE.md and use design/terminal/terminal.css.
Label every number, never show fabricated data, keep border-radius 0.
```
