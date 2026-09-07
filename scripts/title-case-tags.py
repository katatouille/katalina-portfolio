import re, glob

# proper names first — these aren't just capitalisation
EXACT = {
    "adobe illustrator": "Adobe Illustrator",
    "adobe photoshop": "Adobe Photoshop",
    "figma": "Figma", "webflow": "Webflow", "canva": "Canva",
    "squarespace": "Squarespace", "notion": "Notion",
    "google drive": "Google Drive", "procreate": "Procreate",
    "shapr3d": "Shapr3D", "autodesk fusion": "Autodesk Fusion",
    "capcut": "CapCut",
    "klayvio": "Klaviyo",            # the product is spelled Klaviyo
    "ux/ui design": "UX/UI Design",
}
SMALL = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"}

def tc(text):
    low = text.strip().lower()
    if low in EXACT:
        return EXACT[low]
    out, first = [], True
    for word in re.split(r'(\s+)', text.strip()):
        if word.isspace():
            out.append(word); continue
        bare = word.strip("()&")
        if not first and bare.lower() in SMALL:
            out.append(word.lower())
        else:
            # capitalise across hyphens and slashes: manufacturer-ready -> Manufacturer-Ready
            out.append(re.sub(r'(^|[-/(])([a-z])',
                              lambda m: m.group(1) + m.group(2).upper(), word.lower()))
        first = False
    s = "".join(out)
    for k, v in EXACT.items():
        s = re.sub(re.escape(k), v, s, flags=re.I)
    return s

changed = 0
for f in sorted(glob.glob("work/*.html") + glob.glob("play/*.html")):
    s = orig = open(f, encoding="utf-8").read()

    # every tag chip in the meta table
    s = re.sub(r'(<ul class="tags">)(.*?)(</ul>)',
               lambda m: m.group(1) + re.sub(r'<li>(.*?)</li>',
                                             lambda i: "<li>%s</li>" % tc(i.group(1)),
                                             m.group(2)) + m.group(3), s, flags=re.S)

    # the line under the title: "web design, branding, ... · 2026"
    def sub_line(m):
        body = m.group(1)
        parts = body.split(" &middot; ")
        parts[0] = ", ".join(tc(x) for x in parts[0].split(", "))
        return '<p class="project-sub">%s</p>' % " &middot; ".join(parts)
    s = re.sub(r'<p class="project-sub">(.*?)</p>', sub_line, s, flags=re.S)

    # the left rail keeps its lowercase look, but "i" is a capital letter
    s = re.sub(r'(<li><a href="#[^"]+">)([^<]+)(</a></li>)',
               lambda m: m.group(1) + re.sub(r'\bi\b', 'I', m.group(2)) + m.group(3), s)

    if s != orig:
        open(f, "w", encoding="utf-8").write(s)
        changed += 1
print("updated %d project pages" % changed)
