#!/usr/bin/env python3
"""Bump the version shown in the footer of every page.

    python3 scripts/bump-version.py            # patch: 1.1.0 -> 1.1.1  (small fixes)
    python3 scripts/bump-version.py minor      # minor: 1.1.1 -> 1.2.0  (visible changes)
    python3 scripts/bump-version.py major      # major: 1.2.0 -> 2.0.0  (a redesign)
    python3 scripts/bump-version.py --set 1.4.0

The footer shows a quiet "last updated Month YYYY" (today's date). The version
number lives in <span class="version" data-v="X.Y.Z"> on index.html, work/*.html
and play/*.html, and index.html is the source of truth.
"""
import datetime
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = [ROOT / "index.html", *sorted((ROOT / "work").glob("*.html")), *sorted((ROOT / "play").glob("*.html"))]
PATTERN = re.compile(r'<span class="version" data-v="(\d+)\.(\d+)\.(\d+)">[^<]*</span>')
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def main(argv):
    m = PATTERN.search((ROOT / "index.html").read_text(encoding="utf-8"))
    if not m:
        sys.exit("No version span found in index.html")
    major, minor, patch = (int(m.group(i)) for i in (1, 2, 3))

    if "--set" in argv:
        major, minor, patch = (int(x) for x in argv[argv.index("--set") + 1].split("."))
    else:
        kind = argv[0] if argv else "patch"
        if kind == "major":
            major, minor, patch = major + 1, 0, 0
        elif kind == "minor":
            minor, patch = minor + 1, 0
        elif kind == "patch":
            patch += 1
        else:
            sys.exit("Use patch, minor, major, or --set X.Y.Z")

    today = datetime.date.today()
    label = f"{major}.{minor}.{patch}"
    shown = f"last updated {MONTHS[today.month - 1]} {today.year}"

    changed = 0
    for page in PAGES:
        text = page.read_text(encoding="utf-8")
        new, n = PATTERN.subn(f'<span class="version" data-v="{label}">{shown}</span>', text)
        if n and new != text:
            page.write_text(new, encoding="utf-8")
            changed += 1
    print(f"v{label}, {shown}  ({changed} pages updated)")


if __name__ == "__main__":
    main(sys.argv[1:])
