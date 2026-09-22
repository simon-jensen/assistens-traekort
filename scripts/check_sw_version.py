#!/usr/bin/env python3
"""Fejler, hvis cachede filer er ændret uden at VERSION i sw.js er bumpet.

Kør:  python3 scripts/check_sw_version.py <fra-commit> <til-commit>
Service workeren (sw.js) cacher siden hos besøgende under et navn med VERSION.
Ændres index.html, kortet, fontene, ikonerne eller manifestet uden et bump,
ser besøgende den gamle udgave. Se CLAUDE.md, afsnit 1.
"""
import re, subprocess, sys

TRIGGERS = re.compile(r"^(index\.html|kort\.(png|avif|webp)|fonts/.+|icon-\d+\.png|manifest\.webmanifest)$")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def version_at(rev):
    r = git("show", f"{rev}:sw.js")
    if r.returncode != 0:
        return None  # sw.js fandtes ikke
    m = re.search(r"const VERSION\s*=\s*['\"]([^'\"]+)['\"]", r.stdout)
    return m.group(1) if m else ""


def main():
    a = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
    b = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
    if re.fullmatch(r"0+", a):
        print("· Ny branch uden tidligere commit: springer VERSION-tjek over")
        return 0
    mb = git("merge-base", a, b)
    base = mb.stdout.strip() if mb.returncode == 0 else a
    diff = git("diff", "--name-only", base, b)
    if diff.returncode != 0:
        print(f"· Kunne ikke diffe {base}..{b} ({diff.stderr.strip()}): springer over")
        return 0
    changed = [f for f in diff.stdout.split() if TRIGGERS.match(f)]
    if not changed:
        print("· Ingen cachede filer ændret: VERSION-tjek ikke relevant")
        return 0
    old, new = version_at(base), version_at(b)
    if old is None:
        print("· sw.js er ny i denne ændring: VERSION-tjek ikke relevant")
        return 0
    if new is None:
        print("✗ sw.js er fjernet, men cachede filer findes stadig")
        return 1
    if old != new:
        print(f"✓ VERSION bumpet {old} → {new} ({len(changed)} cachede filer ændret)")
        return 0
    print("✗ Cachede filer er ændret, men VERSION i sw.js er stadig '%s':" % new)
    for f in changed:
        print("   -", f)
    print("  Ret linjen  const VERSION = '…';  i sw.js til dagens dato (fx '2026-09-22b') i samme commit.")
    print("  Ellers ser besøgende den gamle udgave. Se CLAUDE.md, afsnit 1.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
