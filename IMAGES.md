# Images

## How it works

Drop images into `assets/projects/<project>/`, then run:

```
python3 scripts/sync-images.py
```

**Every image in the folder shows up.** Nothing is left out and nothing needs a
particular name. The script fills two places on each project page:

- the **hero** at the top, which is the first image in order
- the **Artifacts** gallery at the bottom, which is everything else, stacked

## Order

Sorted by number where there is one, then alphabetically. All of these count as
number 3:

```
03-farmers-market.jpg
03 whatever you like.png
03.jpg
san-03.jpg
```

Files with no number are also matched against the names they had in the old site,
so a lot of them land in the right place on their own. Whatever's left goes after
the numbered ones, alphabetically. To move something, renumber it.

To change which image is the hero, give it the lowest number.

## Captions

Each project folder gets a `captions.txt`. Plain text, one line per image:

```
san-01.jpg = SANWEAR-GT
san-02.jpg = SANWEAR-GT guiding graphics
```

Edit the text after the `=`, save, run `sync-images.py` again. Leave one blank and
the image shows without a caption. New files get appended automatically, pre-filled
where the script recognised them.

## What else the script does

- tidies filenames: `photo.JPG.jpg` becomes `photo.jpg`, spaces and capitals become
  hyphens and lowercase (the server is case-sensitive even though your Mac isn't,
  which is how an image works locally and 404s once deployed)
- makes a preview image from any PDF, and compresses the PDF (your masquerade deck
  went from 44MB to 5MB)
- turns a heavy animated GIF into a silent looping video that plays in the gallery
  (two SAN Sound gifs, 22MB down to 730KB together)
- shrinks anything oversized

Originals are parked in `assets/_originals/`, never deleted. The whole project
folder went from 105MB to 23MB.

---

## The captions it already knows

These came from the previous version of the site. They're the defaults written into
each `captions.txt`; edit them there.

### Gabriel Locke  (`work/gabriel-locke.html`)

 1. Home page
 2. Website result page from the final brand deck
 3. Social media templates
 4. Books page. Note: parallax animations affect how this screenshot was rendered, so visit the site for the full effect.
 5. A peek at the drive with all deliverables: brand foundation, custom how-to guide for Squarespace, social foundation, initial mood board, social media assets, web assets, fonts

### SLATE  (`work/slate.html`)

 1. Peek at the Figma board. Research at a glance: brand audits of competitors, homepage overviews of competitors, a UX/UI positioning matrix, audience and tone, and a lite competitor technical and pricing comparison
 2. Brand overview
 3. The iconography rationale slide
 4. Iteration grids: 15 logomark options exploring composability, orchestration, and customization
 5. A closeup logo iteration sample, with its source reference
 6. Wordmark option and wordmark options grid: eight directions, all stenciled, geometric, or grotesque
 7. A heading option and usage sample
 8. Website design v1

### main thing  (`work/main-thing.html`)

 1. Final logomark
 2. Peek at the Figma board: validating the name, brand positioning matrix, brand audits, moodboard directions, logo iterations, logomark testing as the app icon
 3. Peek at the Figma board: pitch deck testing and creation, plus color palette testing on logomark and website
 4. From the brand exploration deck: Direction 1 and Direction 3
 5. From the brand exploration deck: the chosen path, Direction 2
 6. Final logotype
 7. Pitch deck cards: title, intro, problem & solution, persona
 8. Site design: two homepage versions (one closing on social links, one on apply for membership) plus terms and privacy pages

### SAN Sound  (`work/san-sound.html`)

 1. SANWEAR-GT
 2. SANWEAR-GT guiding graphics
 3. SANWEAR-GT packaging
 4. SANWEAR Test Type 01 packaging and Quick Start Guide
 5. SANWEAR Quick Start Guide, plus BTS making it (so gen z of me, I know)
 6. SANWEAR × Supra colorway proposal
 7. SANWEAR-GT hat: outside graphics and inner label
 8. SANCTUARY newsletter samples 1 & 2: content & design for the SAN Sound subscriber list
 9. SANWEAR IEM social media graphic
10. Snippets of a social media video I shot and edited to help with product usage
11. Final product: SANWEAR-GT on top of SANWEAR TT-01 boxes
12. SANWEAR TEST TYPE (TT) 00
13. SANWEAR Special Edition colorways
14. SANWEAR Faction colorways
15. The final SANWEAR-GT
16. SANWEAR-GT on top of SANWEAR TT-01 boxes

### Masquerade Ball  (`play/masquerade-ball.html`)

 1. Masquerade Ball banner
 2. Masquerade Ball funding proposal — full PDF document
 3. Proposal spread

### By the Bite  (`play/by-the-bite.html`)

 1. Walnut banana muffins packaging label in use
 2. Final logo, and the Authentic Lebanese Hummus packaging label
 3. First attendance at the local farmer's market: banner, product labels, product layout. Not pictured is the framed menu, which was getting printed at this time.
 4. Menu for the farmers market
 5. Final chosen logos
 6. Early directions explored before landing on the final mark

### Silver Lining  (`play/silver-lining.html`)

 1. Front and back cover for the physical CD
 2. Available on all platforms
