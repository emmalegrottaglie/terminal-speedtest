# Maintaining the terminal design system

Instructions for anyone, human or agent, who changes this folder or makes a design decision in an app that uses it.

This folder is the one design system shared by three products:

| Product | Repo | Role of this folder |
|---|---|---|
| Russian bot tracker | `C:\Russian bot tracker` | **Canonical copy.** The tracker serves `terminal.css` live at `/design/terminal.css`. |
| Weather Terminal (Android app) | `C:\MeteoCat Redesign` | Copy, for reference. The app implements the rules natively in `meteocat-app/src`. |
| Retro speed test | `C:\speed test html5 retro terminal` | Copy. The app ships its own `web/css/terminal.css`, copied from this one. |

## The rule

**A design decision is not finished until it is written here.** If a choice made in any of the three apps adds, changes or contradicts a rule or piece of advice in `DESIGN_GUIDE.md`, update the guide in the same piece of work. Examples: a new component or layout pattern, a change of size, spacing or colour role, a new way of showing data, missing data or status, a navigation change, a new screen size the apps support, or something the guide says that turned out to be wrong.

If you aren't sure whether a decision touches the guide, read the relevant section and check. Don't leave the guide describing something the apps no longer do.

## How to update

1. Edit the **canonical copy** in `C:\Russian bot tracker\terminal-design-system`. Never edit one of the other copies on its own; they would drift.
2. Change `DESIGN_GUIDE.md` in the section the decision belongs to. Add a row to the do/don't table (§14) when the decision is easy to get wrong. Keep the guide's voice: plain prose, rules first, the product that settled the rule named when it helps.
3. If the decision needs CSS, add it to `terminal.css`. **Keep changes backward compatible**, because the bot tracker serves this file live: add new classes or variables; don't rename or remove existing ones, and change an existing value only when every product should get the change.
4. If the change is visible, update `specimen.html` or `palettes.html` so they still show every component correctly.
5. If the decision came from research (as §11 did), add or update the source notes in `research-dataviz/` or a sibling folder, and link it from the guide.
6. **Sync every copy.** Replace each copy with the canonical folder, so all three are byte-identical. From any shell with Python:

   ```bash
   python "C:/Russian bot tracker/terminal-design-system/sync_copies.py"
   ```

   Then confirm with `diff -rq` between the canonical folder and each copy. If the speed test's own `web/css/terminal.css` should follow a CSS change, copy that file across too.
7. Update the product code that the decision affects in every app, or note in your summary which apps still need it.
8. Mention in your summary that the design system changed and which sections.

## Folder name

The folder is named `terminal-design-system` in every repo. The bot tracker's `Dockerfile`, `tracker/api.py` and `tracker/static.py`, and the speed test's `.dockerignore` and `README.md`, refer to it by that name; change them together if it is ever renamed.
