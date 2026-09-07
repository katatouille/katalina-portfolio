#!/usr/bin/env python3
"""
Shrink project images for the web.

Run it any time you add images:

    python3 scripts/optimize-images.py

What it does, for every file in assets/projects/*/ :
  - skips anything already small and correctly sized
  - resizes so the long edge is at most MAX_W (2200px for a hero, 1800 otherwise)
  - saves a JPEG at quality 82, or keeps PNG when the image has transparency
  - moves the untouched original into assets/_originals/<project>/

Nothing is deleted. If a result ever looks wrong, the original is still there.
"""

import os, sys, shutil, subprocess, tempfile

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run:  python3 -m pip install --user Pillow")

Image.MAX_IMAGE_PIXELS = None

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS  = os.path.join(ROOT, "assets", "projects")
ORIGINALS = os.path.join(ROOT, "assets", "_originals")

MAX_W_HERO  = 2200
MAX_W_OTHER = 1800
QUALITY     = 82
SIZE_OK     = 450 * 1024          # leave anything already under this alone
GIF_LIMIT   = 1500 * 1024         # a gif bigger than this becomes a silent mp4
PDF_LIMIT   = 2000 * 1024         # a pdf bigger than this gets compressed
EXTS        = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".heic")


def real_alpha(im):
    """True only if the image actually uses transparency. A lot of screenshots
    are RGBA with a fully opaque alpha channel, and those belong in JPEG."""
    if im.mode == "P" and "transparency" in im.info:
        im = im.convert("RGBA")
    if im.mode not in ("RGBA", "LA"):
        return False
    lo, hi = im.getchannel("A").getextrema()
    return lo < 250


def human(n):
    return "%.1fMB" % (n / 1048576) if n >= 1048576 else "%dKB" % (n / 1024)


def discard(path):
    try:
        os.remove(path)
    except OSError:
        pass


def park(src, project):
    """Move a file into assets/_originals/<project>/, never over the top of
       something already there."""
    os.makedirs(os.path.join(ORIGINALS, project), exist_ok=True)
    dest = os.path.join(ORIGINALS, project, os.path.basename(src))
    if os.path.exists(dest):
        root, ext = os.path.splitext(dest)
        n = 2
        while os.path.exists("%s-%d%s" % (root, n, ext)):
            n += 1
        dest = "%s-%d%s" % (root, n, ext)
    shutil.move(src, dest)
    return dest


def convert_gifs():
    """A 13MB animated gif is a page-killer. ffmpeg turns it into a silent,
       looping mp4 a fraction of the size; the page plays it in place of the
       image. The gif is parked, not deleted."""
    if not shutil.which("ffmpeg"):
        return 0
    done = 0
    for project in sorted(os.listdir(PROJECTS)):
        pdir = os.path.join(PROJECTS, project)
        if not os.path.isdir(pdir):
            continue
        for name in sorted(os.listdir(pdir)):
            src = os.path.join(pdir, name)
            if not name.lower().endswith(".gif") or os.path.getsize(src) < GIF_LIMIT:
                continue
            stem = os.path.splitext(src)[0]
            out = stem + ".mp4"
            if os.path.exists(out):
                continue
            before = os.path.getsize(src)
            try:
                subprocess.run([
                    "ffmpeg", "-y", "-loglevel", "error", "-i", src,
                    "-vf", "scale='min(1280,iw)':-2:flags=lanczos",
                    "-c:v", "libx264", "-crf", "26", "-preset", "slow",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out
                ], check=True, capture_output=True)
            except Exception as e:
                print("  could not convert %s (%s)" % (name, e))
                continue
            park(src, project)
            print("  %-50s %8s -> %8s  (mp4)" % (
                project + "/" + os.path.basename(out), human(before), human(os.path.getsize(out))))
            done += 1
    return done


def compress_pdfs():
    """Ghostscript, at a quality that still reads well on screen."""
    if not shutil.which("gs"):
        return 0
    done = 0
    for project in sorted(os.listdir(PROJECTS)):
        pdir = os.path.join(PROJECTS, project)
        if not os.path.isdir(pdir):
            continue
        for name in sorted(os.listdir(pdir)):
            src = os.path.join(pdir, name)
            if not name.lower().endswith(".pdf"):
                continue
            before = os.path.getsize(src)
            if before < PDF_LIMIT:
                continue
            # scratch goes in the system temp dir, not in the site folder
            fd, tmp = tempfile.mkstemp(suffix=".pdf")
            os.close(fd)
            try:
                subprocess.run([
                    "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5",
                    "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dQUIET", "-dBATCH",
                    "-sOutputFile=" + tmp, src
                ], check=True, capture_output=True)
            except Exception as e:
                print("  could not compress %s (%s)" % (name, e))
                discard(tmp)
                continue
            after = os.path.getsize(tmp)
            if after >= before * 0.92:      # not worth the quality loss
                discard(tmp)
                continue
            park(src, project)
            shutil.copyfile(tmp, src)
            discard(tmp)
            print("  %-50s %8s -> %8s  (pdf)" % (
                project + "/" + name, human(before), human(after)))
            done += 1
    return done


def main():
    if not os.path.isdir(PROJECTS):
        sys.exit("no assets/projects folder found")

    convert_gifs()
    compress_pdfs()

    saved = 0
    touched = 0

    for project in sorted(os.listdir(PROJECTS)):
        pdir = os.path.join(PROJECTS, project)
        if not os.path.isdir(pdir):
            continue

        for name in sorted(os.listdir(pdir)):
            src = os.path.join(pdir, name)
            stem, ext = os.path.splitext(name)
            if not os.path.isfile(src) or ext.lower() not in EXTS:
                continue

            before = os.path.getsize(src)
            limit = MAX_W_HERO if stem.startswith("01-") else MAX_W_OTHER

            try:
                im = Image.open(src)
            except Exception as e:
                print("  skip %s (%s)" % (name, e))
                continue

            needs_resize = max(im.size) > limit
            already_done = any(
                os.path.splitext(o)[0] == stem
                for o in (os.listdir(os.path.join(ORIGINALS, project))
                          if os.path.isdir(os.path.join(ORIGINALS, project)) else []))
            if not needs_resize and (before <= SIZE_OK or already_done):
                continue

            im.load()
            has_alpha = real_alpha(im)

            if needs_resize:
                ratio = limit / float(max(im.size))
                im = im.resize(
                    (max(1, int(im.width * ratio)), max(1, int(im.height * ratio))),
                    Image.LANCZOS)

            os.makedirs(os.path.join(ORIGINALS, project), exist_ok=True)

            if has_alpha:
                out = os.path.join(pdir, stem + ".png")
                fd, tmpf = tempfile.mkstemp(suffix=".png"); os.close(fd)
                im.save(tmpf, "PNG", optimize=True)
                keep = os.path.join(ORIGINALS, project, name)
                if os.path.abspath(out) != os.path.abspath(src):
                    shutil.move(src, keep)
                else:
                    shutil.copy2(src, keep)
                shutil.copyfile(tmpf, out); discard(tmpf)
            else:
                out = os.path.join(pdir, stem + ".jpg")
                fd, tmpf = tempfile.mkstemp(suffix=".jpg"); os.close(fd)
                im.convert("RGB").save(tmpf, "JPEG",
                                       quality=QUALITY, optimize=True, progressive=True)
                keep = os.path.join(ORIGINALS, project, name)
                if os.path.abspath(out) != os.path.abspath(src):
                    shutil.move(src, keep)          # different extension: park the original
                else:
                    shutil.copy2(src, keep)
                shutil.copyfile(tmpf, out); discard(tmpf)

            after = os.path.getsize(out)
            saved += before - after
            touched += 1
            print("  %-52s %8s -> %8s  (%dx%d)" % (
                project + "/" + os.path.basename(out), human(before), human(after),
                im.width, im.height))

    if touched:
        print("\n%d file%s optimized, %s saved. Originals are in assets/_originals/." % (
            touched, "" if touched == 1 else "s", human(saved)))
    else:
        print("Everything is already web-sized. Nothing to do.")


if __name__ == "__main__":
    main()
