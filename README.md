# katalinavasquez — static site

Plain HTML and CSS. No build step, no dependencies, nothing to install.
Open `index.html` in a browser to preview it locally.

## Structure

```
index.html              the whole homepage — welcome, work, play, career, contact
css/style.css           the only stylesheet
js/site.js              image slots, the left nav's active state, click-to-enlarge
fonts/*.woff2           Neue Haas Display, six cuts, web-compressed
work/*.html             four case studies
play/*.html             three side projects
assets/welcome/         the island dot art
assets/projects/<slug>/ one folder per project — drop images here (see IMAGES.md)
assets/_originals/      untouched full-size images, parked by the optimizer
scripts/sync-images.py  the one command to run after adding images
scripts/                the optimizer and the slot table
_archive/               the old island site and draft copy. Nothing links to it.
```

## Adding images

1. Drop files into `assets/projects/<project>/`. Any name, any extension.
2. Run:

   ```
   python3 scripts/sync-images.py
   ```

Every image in the folder appears on the page: the first one becomes the hero at
the top, the rest fill the Artifacts gallery at the bottom. Order is by number where
there is one (`03-x.jpg`, `san-03.jpg`) and alphabetical otherwise, and unnumbered
files are also matched against the names they had in the old site. Captions live in
each folder's `captions.txt` as plain text.

That one command tidies filenames (including stripping spaces and capitals, which
matter on a case-sensitive server), makes a preview image from any PDF and
compresses the PDF, turns a heavy animated GIF into a silent looping video the page
plays in the slot, optimizes anything oversized (originals parked in
`assets/_originals/`, nothing deleted), points each slot at the file you actually
put there, and prints a report of what's filled, what's empty, and what it couldn't
place. It took the project images from 105MB to 23MB.

It also recognises files by the names they had in the old version of the site, so a
number of images land correctly with no renaming at all.

`scripts/optimize-images.py` is the resizing half on its own, if you ever want just
that. `scripts/slots.json` is the slot table the sync script reads.

Any slot without a file shows a dashed box naming what it wants, so you can open a
page any time and see what's left. Nothing breaks in the meantime.

**The first image is the hero.** It sits under the title, cropped to a banner, and
it's the first thing anyone sees. Landscape images work best there. Give an image
the lowest number to make it the hero. Clicking any image opens it full size.

Each case study reads straight through with no images interrupting it, and every
picture sits together under **Artifacts** at the end, with its own entry in the
left rail.

## Type

Six cuts of Neue Haas Display are self-hosted from `fonts/`, converted from your
`.ttf` files to `.woff2` (about a quarter of the size). Light 45 carries the
display text — the welcome line, project titles, the nav. Body copy uses Roman 55,
because Light at 16–17px gets thin enough to be hard work to read. Because it's a
display cut its word space is tight at text sizes, so the CSS adds a little
`word-spacing` back.

One thing worth checking: desktop font licenses usually don't cover embedding a
font on a website. Worth confirming what your Neue Haas license allows before the
site goes public. If it turns out not to be covered, swapping the `@font-face`
block for a webfont license or a free near-match is a ten-minute change, and the
fallback stack already degrades to Helvetica.

## The purple

`--accent` in `css/style.css`. `#D071FF` is used as-is in dark mode. In light mode
it only reaches 2.7:1 against the background, which fails WCAG AA for text, so
light mode uses `#A63CE0` — same family, 4.7:1. Change the one token if you'd
rather have the exact hex everywhere.

## Deploying to GitHub Pages

The site is already Pages-ready: no build step, and `.nojekyll` is in place so
nothing gets swallowed by Jekyll.

1. Create a repo and push this folder to it.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Settings → Pages → Custom domain: enter your domain, then add the DNS records
   GitHub shows you at your registrar. Tick "Enforce HTTPS" once it goes green.

Two things to know:

- On the free plan, Pages only publishes from a **public** repo. Everything here
  is portfolio material anyway, but it does mean the folder is public.
- Pages serves from Linux, which is case-sensitive. `Logo.PNG` and `logo.png` are
  different files there but the same file on your Mac, so an image can work
  locally and 404 once deployed. The optimizer writes lowercase names, so as long
  as you follow `IMAGES.md` you're fine.

Cloudflare Pages is the other good option and works from a private repo, but
there's no strong reason to switch. GitHub Pages is a fine home for this.
