#!/usr/bin/env python3
"""
One command to run after you drop images into assets/projects/.

    python3 scripts/sync-images.py

It does four things:

  1. Tidies filenames — a double extension like `photo.JPG.jpg` becomes `photo.jpg`.
  2. Turns the first page of any PDF in a project folder into a preview image,
     so a deck or proposal can sit in an image slot.
  3. Optimizes anything oversized (scripts/optimize-images.py), parking the
     untouched originals in assets/_originals/.
  4. Points each slot on each page at the file you actually put there.

On step 4 you only have to get the NUMBER right. A slot labelled `03-` in
IMAGES.md will pick up `03-anything-you-like.jpg`, `03 farmers market.png`, or
just `03.jpg`. Everything after the number is yours.

Files with no leading number are listed at the end as unclaimed. Nothing is
guessed — a photo under the wrong caption is worse than an empty slot.

Re-run it as often as you like; it's safe to run twice.
"""

import os, re, sys, glob, json, shutil, subprocess

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS = os.path.join(ROOT, "assets", "projects")
IMG_EXT  = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".mp4")

sys.path.insert(0, os.path.join(ROOT, "scripts"))


def web_safe(stem):
    """`Screenshot 2026-08-06 at 2.14 AM (1)` -> `screenshot-2026-08-06-at-2-14-am-1`

    Spaces, parentheses and capitals all make brittle URLs, and the server this
    site lands on is case-sensitive even though your Mac isn't — so a file can
    work locally and 404 once it's deployed. Normalising here means that can't
    happen."""
    stem = re.sub(r"[^A-Za-z0-9]+", "-", stem)
    return re.sub(r"-{2,}", "-", stem).strip("-").lower() or "image"


def tidy_names():
    """`photo.JPG.jpg` -> `photo.jpg`, plus web-safe, lowercase, no spaces."""
    fixed = 0
    for path in glob.glob(os.path.join(PROJECTS, "*", "*")):
        if not os.path.isfile(path):
            continue
        d, name = os.path.split(path)
        stem, ext = os.path.splitext(name)
        if ext.lower() not in IMG_EXT + (".pdf",):
            continue
        # strip a redundant inner extension
        inner_stem, inner_ext = os.path.splitext(stem)
        if inner_ext.lower() in IMG_EXT:
            stem = inner_stem
        new = web_safe(stem) + ext.lower()
        if new == name:
            continue
        target = os.path.join(d, new)
        if os.path.exists(target):
            root, e = os.path.splitext(new)
            n = 2
            while os.path.exists(os.path.join(d, "%s-%d%s" % (root, n, e))):
                n += 1
            target = os.path.join(d, "%s-%d%s" % (root, n, e))
        os.rename(path, target)
        print("  renamed  %s  ->  %s" % (name, os.path.basename(target)))
        fixed += 1
    return fixed


def pdf_previews():
    """First page of any PDF becomes <stem>.jpg beside it, if not already there."""
    made = 0
    for pdf in glob.glob(os.path.join(PROJECTS, "*", "*.pdf")):
        stem = os.path.splitext(pdf)[0]
        if any(os.path.exists(stem + e) for e in IMG_EXT):
            continue
        try:
            subprocess.run(["pdftoppm", "-jpeg", "-r", "150", "-f", "1", "-l", "1",
                            "-singlefile", pdf, stem],
                           check=True, capture_output=True)
            print("  pdf page 1  ->  %s.jpg" % os.path.basename(stem))
            made += 1
        except Exception as e:
            print("  could not read %s (%s)" % (os.path.basename(pdf), e))
    return made


def optimize():
    try:
        import importlib
        opt = importlib.import_module("optimize-images".replace("-", "_"))
    except Exception:
        # the module name has a hyphen, so load it by path
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "optimize_images", os.path.join(ROOT, "scripts", "optimize-images.py"))
        opt = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(opt)
    opt.main()


SLOTS = {}
_sj = os.path.join(ROOT, "scripts", "slots.json")
if os.path.exists(_sj):
    SLOTS = json.load(open(_sj, encoding="utf-8"))


def norm(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())


def tokens(t):
    return {w for w in re.split(r"[^a-z0-9]+", t.lower()) if len(w) > 2 and not w.isdigit()}


def clean_stem(name):
    """`F36kbYhaIAAAcC4 (1).jpg` -> `F36kbYhaIAAAcC4`"""
    stem = os.path.splitext(name)[0]
    return re.sub(r"\s*\(\d+\)\s*$", "", stem).strip()


def stem_variants(name):
    """Both the name and the name without a trailing `-1` style copy suffix, so
       `slate-logo-exploration-v3-13-1` still matches the file it came from."""
    stem = clean_stem(name)
    out = [stem]
    trimmed = re.sub(r"-\d$", "", stem)
    if trimmed != stem and re.search(r"\d$", trimmed):
        out.append(trimmed)
    return out


def guess_slot(filename, slug, taken):
    """Match a free-named file to a slot using the source filenames recorded from
       the previous version of the site, plus the slot's own name. Only returns a
       slot when exactly one candidate matches — a photo under the wrong caption
       is worse than an empty slot."""
    if slug not in SLOTS:
        return None
    variants = stem_variants(filename)
    nfs = [norm(v) for v in variants if len(norm(v)) >= 4]
    tf = tokens(variants[0])
    if not nfs:
        return None
    nf = nfs[0]

    strong, weak = [], []
    for slot in SLOTS[slug]:
        if slot["n"] in taken:
            continue
        base = re.sub(r"^\d+-", "", slot["base"])
        hint = slot["hint"] if len(slot["hint"]) <= 130 else ""
        nh, nb = norm(hint), norm(base)

        # precise: the file still carries the name it had in the old site,
        # or its name is substantially the slot's own name
        precise = False
        for v in nfs:
            if (nh and (v in nh or (len(nh) >= 10 and nh in v))) or \
               (nb and (v == nb
                        or (v in nb and len(v) / len(nb) >= 0.75)
                        or (nb in v and len(nb) / len(v) >= 0.75))):
                precise = True
                break
        if precise:
            strong.append(slot["n"])
            continue

        # fuzzy: near-total overlap of the meaningful words. Only consulted
        # when nothing matched precisely, because a whole folder of
        # `slate-logo-exploration-v3-NN` files overlaps every slot's words.
        th = tokens(base) | tokens(hint)
        if tf and len(tf & th) >= 2 and len(tf & th) / len(tf) >= 0.8:
            weak.append(slot["n"])

    if len(strong) == 1:
        return strong[0]
    if not strong and len(weak) == 1:
        return weak[0]
    return None


def slot_number(name):
    """The slot you meant, read off the filename.

    `03-anything.jpg`, `03 anything.png`, `03.jpg` — number first.
    `san-03.jpg`, `mt-03.png`   — a short prefix then the number, which is how
                                  it's natural to name a batch from one project.
    """
    stem = os.path.splitext(name)[0]
    m = re.match(r'^(\d{1,2})\s*[-_. ]', name)
    if m:
        return int(m.group(1))
    if re.match(r'^\d{1,2}$', stem):
        return int(stem)
    m = re.match(r'^[A-Za-z]{1,6}[-_ ](\d{1,2})$', stem)
    return int(m.group(1)) if m else None


CAPTION_HEADER = """# Captions for this project's Artifacts gallery.
#
# One line per image:   filename = caption
# Edit the text after the "=", save, then run:  python3 scripts/sync-images.py
# Leave a caption empty and the image shows without one.
# New files you add get appended here automatically.
"""


def read_captions(folder):
    path = os.path.join(folder, "captions.txt")
    out = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def write_captions(folder, ordered, captions):
    """Rewrite captions.txt in gallery order, keeping whatever she's typed."""
    lines = [CAPTION_HEADER]
    for f in ordered:
        lines.append("%s = %s" % (f, captions.get(f, "")))
    open(os.path.join(folder, "captions.txt"), "w", encoding="utf-8").write(
        "\n".join(lines) + "\n")


def esc(t):
    """captions.txt is plain text; the page is html."""
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def figure_html(slug, filename, caption, hero=False):
    src = "../assets/projects/%s/%s" % (slug, filename)
    caption = esc(caption)
    alt = caption.replace('"', "&quot;")
    cls = "shot hero" if hero else "shot"
    lazy = "" if hero else ' loading="lazy"'
    hero_attr = ' data-hero="%s"' % slug if hero else ""

    # a PDF's first-page preview is still just a flat picture of page one —
    # link it straight to the real, full document instead of leaving it inert
    stem = os.path.splitext(filename)[0]
    pdf_path = os.path.join(PROJECTS, slug, stem + ".pdf")
    if os.path.exists(pdf_path):
        cls += " pdf"
        pdf_href = "../assets/projects/%s/%s.pdf" % (slug, stem)
        img_html = ('<a class="pdf-open" href="%s" target="_blank" rel="noopener">\n'
                    '        <img src="%s" alt="%s"%s />\n'
                    '      </a>' % (pdf_href, src, alt, lazy))
    else:
        img_html = '<img src="%s" alt="%s"%s />' % (src, alt, lazy)

    return ('    <figure class="%s"%s>\n'
            '      %s\n'
            '      <figcaption>%s</figcaption>\n'
            '    </figure>' % (cls, hero_attr, img_html, caption))


def gallery(slug):
    """Everything in the project folder, in a sensible order, with captions."""
    folder = os.path.join(PROJECTS, slug)
    if not os.path.isdir(folder):
        return [], {}

    files = [f for f in sorted(os.listdir(folder))
             if os.path.splitext(f)[1].lower() in IMG_EXT]

    # a slot number, from the filename first and recognition second, is only
    # used for ordering and for a default caption now — nothing gets dropped
    placed, taken = {}, set()
    for f in files:
        n = slot_number(f)
        if n is not None and n not in taken:
            placed[f] = n
            taken.add(n)
    for f in files:
        if f in placed:
            continue
        n = guess_slot(f, slug, taken)
        if n is not None:
            placed[f] = n
            taken.add(n)

    ordered = sorted(files, key=lambda f: (placed.get(f, 99), f.lower()))

    slot_caption = {}
    for slot in SLOTS.get(slug, []):
        slot_caption[slot["n"]] = slot["caption"]

    captions = read_captions(folder)
    for f in ordered:
        if f not in captions:
            captions[f] = slot_caption.get(placed.get(f), "")
        captions[f] = captions[f].replace("&amp;", "&")
    write_captions(folder, ordered, captions)

    return ordered, captions


# which project comes next, in the same loop the pages already link in
NEXT_PROJECT = {
    "gabriel-locke":   "slate",
    "slate":           "main-thing",
    "main-thing":      "san-sound",
    "san-sound":       "gabriel-locke",
    "masquerade-ball": "by-the-bite",
    "by-the-bite":     "silver-lining",
    "silver-lining":   "masquerade-ball",
}
PROJECT_NAMES = {
    "gabriel-locke":   "Gabriel Locke",
    "slate":           "SLATE",
    "main-thing":      "main thing",
    "san-sound":       "SAN Sound",
    "masquerade-ball": "Masquerade Ball",
    "by-the-bite":     "By the Bite",
    "silver-lining":   "Silver Lining",
}


def next_link_html(slug):
    """A small preview card: where you're headed next, with its hero image
       as a sneak peek instead of a plain text link."""
    nxt = NEXT_PROJECT.get(slug)
    if not nxt:
        return None
    name = PROJECT_NAMES.get(nxt, nxt)
    ordered, captions = gallery(nxt)
    hero = ordered[0] if ordered else None
    shot = ""
    if hero:
        shot = ('\n    <span class="next-shot">'
                '<img src="../assets/projects/%s/%s" alt="" loading="lazy" /></span>'
                % (nxt, hero))
    return ('  <a class="next-link" href="%s.html">\n'
            '    <span class="next-text"><span class="next-label">Next</span>'
            '<span class="next-name">%s</span></span>%s\n'
            '  </a>' % (nxt, esc(name), shot))


def relink():
    pages = sorted(glob.glob(os.path.join(ROOT, "work", "*.html")) +
                   glob.glob(os.path.join(ROOT, "play", "*.html")))
    total = 0

    for page in pages:
        html = open(page, encoding="utf-8").read()
        m = re.search(r'data-artifacts="([^"]+)"', html)
        if not m:
            continue
        slug = m.group(1)
        ordered, captions = gallery(slug)

        hero = ordered[0] if ordered else None
        rest = ordered[1:] if ordered else []

        # --- the hero figure -------------------------------------------
        if hero:
            new_hero = figure_html(slug, hero, captions.get(hero, ""), hero=True)
        else:
            new_hero = ('    <figure class="shot hero" data-hero="%s">\n'
                        '      <div class="slot">no images in assets/projects/%s/ yet</div>\n'
                        '    </figure>' % (slug, slug))
        html = re.sub(r'[ \t]*<figure class="shot hero" data-hero="[^"]+">.*?</figure>',
                      lambda _: new_hero, html, count=1, flags=re.S)

        # --- the artifacts gallery -------------------------------------
        body = "\n".join(figure_html(slug, f, captions.get(f, "")) for f in rest)
        html = re.sub(r'(<div class="shots" data-artifacts="%s">).*?(</div>)' % re.escape(slug),
                      lambda _: '<div class="shots" data-artifacts="%s">\n%s\n  </div>'
                                % (slug, body) if body else
                                '<div class="shots" data-artifacts="%s"></div>' % slug,
                      html, count=1, flags=re.S)

        # nothing to show? drop the section and its rail entry rather than
        # leaving an empty heading on the page
        if not rest:
            html = re.sub(r'[ \t]*<section class="artifacts">.*?</section>\n', '', html, flags=re.S)
            html = re.sub(r'[ \t]*<li><a href="#artifacts">artifacts</a></li>\n', '', html)

        # --- next-project preview card -----------------------------------
        new_next = next_link_html(slug)
        if new_next:
            # already the new <a> card (a re-run) vs. the original plain
            # <p>Next: <a href>...</a></p> link (first run) — matched
            # separately so the non-greedy body never stops at the wrong
            # closing tag
            m = re.search(r'[ \t]*<a class="next-link">.*?</a>', html, flags=re.S)
            if not m:
                m = re.search(r'[ \t]*<p class="next-link">.*?</p>', html, flags=re.S)
            if m:
                html = html[:m.start()] + new_next + html[m.end():]

        open(page, "w", encoding="utf-8").write(html)
        total += len(ordered)
        print("  %-18s hero: %-42s + %d in Artifacts"
              % (slug, hero or "(none)", len(rest)))

    print("\n%d images placed across the site." % total)
    print("Captions live in assets/projects/<project>/captions.txt — edit and re-run.")


def main():
    print("Tidying filenames")
    tidy_names()
    print("\nLooking for PDFs")
    pdf_previews()
    print("\nOptimizing")
    optimize()
    print("\nLinking images to slots")
    relink()


if __name__ == "__main__":
    main()
