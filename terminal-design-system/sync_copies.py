"""Copy the canonical terminal design system over every other copy.

Run from anywhere:  python "C:/Russian bot tracker/terminal-design-system/sync_copies.py"

The canonical folder is the one in the bot tracker repo (see AGENTS.md). Each
copy is deleted and replaced, so the copies end up byte-identical to it.
Nothing outside the copies' own folders is touched.
"""

import filecmp
import shutil
import sys
from pathlib import Path

CANONICAL = Path(r"C:/Russian bot tracker/terminal-design-system")
COPIES = [
    Path(r"C:/MeteoCat Redesign/terminal-design-system"),
    Path(r"C:/speed test html5 retro terminal/terminal-design-system"),
]
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc")


def differences(a: Path, b: Path) -> list[str]:
    """Relative paths that differ between two folder trees."""
    cmp = filecmp.dircmp(a, b, ignore=["__pycache__"])
    out = [str(Path(a.name) / n) for n in cmp.left_only + cmp.right_only + cmp.diff_files + cmp.funny_files]
    for sub in cmp.common_dirs:
        out += differences(a / sub, b / sub)
    return out


def main() -> int:
    if Path(__file__).resolve().parent != CANONICAL.resolve():
        print(f"Run the copy in {CANONICAL}; this one is not canonical.", file=sys.stderr)
        return 1
    for copy in COPIES:
        if not copy.parent.is_dir():
            print(f"skip {copy}: repo not found")
            continue
        if copy.exists():
            shutil.rmtree(copy)
        shutil.copytree(CANONICAL, copy, ignore=IGNORE)
        left = differences(CANONICAL, copy)
        print(f"{'ok  ' if not left else 'DIFF'} {copy}" + (f": {left}" if left else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
