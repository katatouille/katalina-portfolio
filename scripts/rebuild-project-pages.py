#!/usr/bin/env python3
"""
Regenerates the seven project pages from the pre-rebuild HTML in _archive/pages/.

You almost certainly don't need this — the pages are finished and have been edited
by hand since. It's here so the structure stays reproducible if a page ever has to
be rebuilt from scratch.

If you do run it, run these two straight after, in this order:

    python3 scripts/title-case-tags.py     # tags, and the line under the title
    python3 scripts/sync-images.py         # re-points every slot at its real file

Anything edited by hand on those pages will be lost, so commit first.
"""

import re, os, json

ROOT = os.getcwd()
SRC  = os.path.join(ROOT, "_archive", "pages")

PAGES = [
    ("work", "gabriel-locke",  "Gabriel Locke",   "slate.html",           "SLATE"),
    ("work", "slate",          "SLATE",           "main-thing.html",      "main thing"),
    ("work", "main-thing",     "main thing",      "san-sound.html",       "SAN Sound"),
    ("work", "san-sound",      "SAN Sound",       "gabriel-locke.html",   "Gabriel Locke"),
    ("play", "masquerade-ball","Masquerade Ball", "by-the-bite.html",     "By the Bite"),
    ("play", "by-the-bite",    "By the Bite",     "silver-lining.html",   "Silver Lining"),
    ("play", "silver-lining",  "Silver Lining",   "masquerade-ball.html", "Masquerade Ball"),
]

EXTRA_SAN = [
    ("12-sanwear-test-type-tt-00", "SANWEAR TEST TYPE (TT) 00"),
    ("13-sanwear-special-edition-colorways", "SANWEAR Special Edition colorways"),
    ("14-sanwear-faction-colorways", "SANWEAR Faction colorways"),
    ("15-sanwear-gt-final", "The final SANWEAR-GT"),
    ("16-sanwear-gt-on-tt-01-boxes", "SANWEAR-GT on top of SANWEAR TT-01 boxes"),
]

FIG_RE = re.compile(
    r'(?:<!--\s*(?P<hint>.*?)\s*-->\s*)?'
    r'<figure[^>]*>\s*<div class="plate"><div class="fill"></div></div>\s*'
    r'<figcaption class="plate-caption">(?P<cap>.*?)</figcaption>\s*</figure>', re.S)
FIELD_RE = re.compile(r'<div class="field">\s*<h2>(.*?)</h2>\s*(.*?)\s*</div>', re.S)

def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    for a, b in [('&amp;','&'),('&rsquo;',"'"),('&nbsp;',' '),('&mdash;','-'),
                 ('&ndash;','-'),('&times;','x'),('&lt;','<'),('&gt;','>'),('&quot;','"')]:
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()

def slugify(s, words=6):
    s = re.sub(r"[^a-z0-9\s-]", "", strip_tags(s).lower())
    return "-".join([p for p in s.split() if p][:words]) or "x"

def squash(s):
    return re.sub(r'\s+', ' ', s).strip()

def dedent(s, n=6):
    return "\n".join(re.sub(r'^ {%d}' % n, '', ln) for ln in s.split("\n"))

def figure(slug, base, cap, bleed=False):
    return ('  <figure class="shot%s">\n'
            '    <img data-src="../assets/projects/%s/%s" alt="%s"%s />\n'
            '    <div class="slot"></div>\n'
            '    <figcaption>%s</figcaption>\n'
            '  </figure>' % (" hero" if bleed else "", slug, base,
                             strip_tags(cap).replace('"', "&quot;"),
                             "" if bleed else ' loading="lazy"', cap))

manifest = []

for section, slug, title, next_href, next_name in PAGES:
    raw  = open(os.path.join(SRC, section, slug + ".html"), encoding="utf-8").read()
    main = re.search(r'<main>(.*?)</main>', raw, re.S).group(1)

    # ---- sidebar -> meta ----
    aside = re.search(r'<aside class="project-sidebar">(.*?)</aside>', main, re.S).group(1)
    meta_rows, lede, tag_bits, year = [], "", [], ""
    for h, body in FIELD_RE.findall(aside):
        h, hl = h.strip(), h.strip().lower()
        if hl in ("project overview", "summary"):
            lede = squash(re.sub(r'^<p>|</p>$', '', body.strip())); continue
        if hl == "year":
            year = strip_tags(body); meta_rows.append(("Year", year)); continue
        if '<ul class="tags">' in body:
            items = [squash(i) for i in re.findall(r'<li>(.*?)</li>', body, re.S)]
            if hl in ("deliverables", "type of work"): tag_bits += items
            meta_rows.append((h, '<ul class="tags">' + "".join("<li>%s</li>" % i for i in items) + "</ul>"))
            continue
        meta_rows.append((h, squash(re.sub(r'^<p>|</p>$', '', body.strip()))))

    sub = ", ".join(tag_bits)
    sub = (sub + " &middot; " + year) if (sub and year) else (sub or year)
    meta_html = "\n".join('      <dt>%s</dt><dd>%s</dd>' % (k, v) for k, v in meta_rows)

    # ---- prose ----
    m = re.search(r'<div class="project-prose">(.*?)</div>\s*<div class="project-last-row">', main, re.S)
    prose = ""
    if m:
        prose = m.group(1).rstrip()
        if len(re.findall(r'</div>', prose)) > len(re.findall(r'<div\b', prose)):
            prose = prose[:prose.rfind("</div>")].rstrip()
        prose = prose.replace('class="project-note"', 'class="note"')
        prose = re.sub(r'\s*<!--.*?-->', '', prose, flags=re.S)
        prose = dedent(prose).strip()

    # ---- figures ----
    figs = [(squash(f.group("cap")), (f.group("hint") or "").strip()) for f in FIG_RE.finditer(main)]
    if slug == "san-sound":
        figs += [(c, "from the SAN X account") for _, c in EXTRA_SAN]

    files = []
    for i, (cap, hint) in enumerate(figs, 1):
        base = "%02d-%s" % (i, slugify(cap))
        if slug == "san-sound" and i > 11:
            base = EXTRA_SAN[i - 12][0]
        files.append({"file": base, "caption": cap, "source_hint": hint})

    # ---- split prose into h2 sections ----
    parts = re.split(r'(?=<h2>)', prose) if prose else []
    parts = [p for p in parts if p.strip()]
    pre = ""
    if parts and not parts[0].lstrip().startswith("<h2>"):
        pre = parts.pop(0)

    sections = []
    for p in parts:
        h = re.match(r'<h2>(.*?)</h2>', p.strip(), re.S)
        name = strip_tags(h.group(1)) if h else "Section"
        sid = slugify(name, 5)
        body = re.sub(r'^<h2>(.*?)</h2>', '<h2 id="%s">\\1</h2>' % sid, p.strip(), count=1, flags=re.S)
        sections.append({"id": sid, "name": name, "html": body, "imgs": []})

    # ---- assemble body ----
    # Images no longer sit between the paragraphs. Every case study reads
    # straight through, and all the pictures live together in Artifacts at the
    # end. sync-images.py fills both the hero and that gallery from whatever is
    # actually in assets/projects/<slug>/.
    out = []
    out.append('  <figure class="shot hero" data-hero="%s">\n'
               '    <img alt="%s" />\n'
               '    <div class="slot"></div>\n'
               '    <figcaption></figcaption>\n'
               '  </figure>\n' % (slug, title.replace('"', "&quot;")))

    if lede:
        out.append('  <p class="lede" id="overview">%s</p>\n' % lede)
    out.append('    <dl class="meta">\n%s\n    </dl>\n' % meta_html)

    if prose or sections:
        body = []
        if pre.strip():
            body.append(pre.strip())
        for sec in sections:
            body.append(sec["html"])
        out.append('  <div class="prose">\n%s\n  </div>\n' % "\n\n".join(body))

    out.append('  <section class="artifacts">\n'
               '    <h2 class="label" id="artifacts">Artifacts</h2>\n'
               '    <div class="shots" data-artifacts="%s"></div>\n'
               '  </section>\n' % slug)

    out.append('  <p class="next-link">Next: <a href="%s">%s</a></p>\n' % (next_href, next_name))
    body_html = "\n".join(out)

    # ---- left rail ----
    rail = ['      <li><a href="#overview">overview</a></li>'] if lede else []
    rail += ['      <li><a href="#%s">%s</a></li>' % (sec["id"], sec["name"].lower()) for sec in sections]
    rail += ['      <li><a href="#artifacts">artifacts</a></li>']
    rail_html = ""
    if rail:
        rail_html = ('    <p class="rail-heading">On this page</p>\n'
                     '    <ul class="rail-sections">\n%s\n    </ul>\n' % "\n".join(rail))

    manifest.append({"section": section, "slug": slug, "title": title, "images": files})

    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title} &mdash; Katalina Vasquez</title>
<meta name="description" content="{desc}" />
<link rel="preload" href="../fonts/NeueHaasDisplay-Light.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="../fonts/NeueHaasDisplay-Roman.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="../css/style.css" />
</head>
<body>

<a class="skip" href="#top">Skip to content</a>

<nav class="sidenav" aria-label="Page sections">
  <div class="rail-back"><a href="../index.html#{section}">&larr; katalina</a></div>
{rail}</nav>

<main class="col" id="top">

  <header class="project-head">
    <h1 class="project-title">{title}</h1>
    <p class="project-sub">{sub}</p>
  </header>

{body}
  <footer class="site-foot">
    <div><a href="../index.html">&copy; 2026 Katalina Vasquez</a></div>
    <div><a href="mailto:hello.katalinakv@gmail.com">hello.katalinakv@gmail.com</a></div>
  </footer>

</main>

<script src="../js/site.js"></script>
</body>
</html>
""".format(title=title, desc=strip_tags(lede)[:165], section=section,
           sub=sub, rail=rail_html, body=body_html)

    open(os.path.join(ROOT, section, slug + ".html"), "w", encoding="utf-8").write(html)
    os.makedirs(os.path.join(ROOT, "assets", "projects", slug), exist_ok=True)
    print("%-24s %2d images  %d sections" % (section + "/" + slug, len(files), len(sections)))

json.dump(manifest, open("/tmp/manifest.json", "w"), indent=2)
