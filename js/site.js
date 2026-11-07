/* katalinaisland.online: three small things:
   1. image slots that resolve any common extension, and name themselves when empty
   2. the left rail highlighting whichever section you're reading
   3. click an image to see it big
   No dependencies. Everything degrades to plain HTML if this file never loads. */

(function () {
  "use strict";

  /* ---------- 1. images ------------------------------------------------

     sync-images.py writes the real filename into every <img src>, so there is
     nothing to guess here. This only does the two things css can't:
       - an oversized gif was converted to a silent looping mp4 → play it
       - a portrait image gets tagged so it can be fitted to the screen        */

  function tagTall(img) {
    if (img.naturalWidth && img.naturalHeight / img.naturalWidth > 1.45) {
      img.classList.add("is-tall");
    }
    img.dataset.loaded = "1";
  }

  document.querySelectorAll(".shot img").forEach(function (img) {
    var src = img.getAttribute("src") || "";

    if (/\.(mp4|webm)$/i.test(src)) {
      var v = document.createElement("video");
      v.src = src;
      v.autoplay = v.loop = v.muted = v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("aria-label", img.alt || "");
      img.replaceWith(v);
      return;
    }

    img.addEventListener("load", function () { tagTall(img); });
    img.addEventListener("error", function () {
      var fig = img.closest(".shot");
      fig.classList.add("shot--missing");
      var slot = fig.querySelector(".slot");
      if (slot) slot.textContent = src.replace(/^\.\.\//, "");
    });
    if (img.complete) tagTall(img);
  });

  /* ---------- 2. scroll spy on the left rail ---------------------------- */

  var rail = document.querySelector(".sidenav");

  if (rail) {
    var links = [].slice.call(rail.querySelectorAll('a[href^="#"]'));
    var targets = links
      .map(function (a) {
        var el = document.getElementById(a.getAttribute("href").slice(1));
        return el ? { link: a, el: el } : null;
      })
      .filter(Boolean);

    if (targets.length) {
      var current = null;

      var spy = function () {
        var line = window.scrollY + window.innerHeight * 0.28;
        // on the homepage nothing is highlighted until you reach a section;
        // case study pages start on their first anchor
        var pick = document.body.hasAttribute("data-home") ? null : targets[0];

        for (var i = 0; i < targets.length; i++) {
          if (targets[i].el.getBoundingClientRect().top + window.scrollY <= line) {
            pick = targets[i];
          }
        }

        // pin the last item once you've hit the bottom of the page
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
          pick = targets[targets.length - 1];
        }

        if (pick !== current) {
          if (current) {
            current.link.classList.remove("is-active");
            current.link.removeAttribute("aria-current");
          }
          if (pick) {
            pick.link.classList.add("is-active");
            pick.link.setAttribute("aria-current", "true");
          }
          current = pick;
        }
      };

      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { spy(); ticking = false; });
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      spy();
    }
  }

  /* ---------- 3. lightbox ---------------------------------------------- */

  // a pdf's preview links straight to the real document, so it
  // skips the lightbox rather than fighting the link for the click
  var shots = document.querySelectorAll(".shot:not(.pdf) img");
  if (!shots.length) return;

  var box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Enlarged image");
  box.innerHTML =
    '<button class="lightbox-close" aria-label="Close">&times;</button>' +
    '<img alt="" /><div class="lightbox-cap"></div>';
  document.body.appendChild(box);

  var boxImg = box.querySelector("img");
  var boxCap = box.querySelector(".lightbox-cap");
  var lastFocus = null;

  function open(src, alt, cap) {
    lastFocus = document.activeElement;
    boxImg.src = src;
    boxImg.alt = alt || "";
    boxCap.textContent = cap || "";
    box.classList.add("is-open");
    document.body.style.overflow = "hidden";
    box.querySelector(".lightbox-close").focus();
  }

  function close() {
    box.classList.remove("is-open");
    boxImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  shots.forEach(function (img) {
    img.addEventListener("click", function () {
      if (!img.dataset.loaded) return;          // nothing to enlarge yet
      var fig = img.closest(".shot");
      var cap = fig ? fig.querySelector("figcaption") : null;
      open(img.currentSrc || img.src, img.alt, cap ? cap.textContent : "");
    });
  });

  box.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box.classList.contains("is-open")) close();
  });
})();

/* ---------- 4. light / dark toggle ------------------------------------ */

(function () {
  var toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", function () {
    var root = document.documentElement;
    var current = root.getAttribute("data-theme");
    var effectiveDark = current === "dark";
    var next = effectiveDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();


/* ---------- 5. card to case study transition ---------------------------
   Names the clicked card's image so the browser can morph it into the
   case study hero (and back). Only on browsers with cross-document view
   transitions; everywhere else this does nothing and links just navigate. */

(function () {
  if (!("onpageswap" in window)) return;

  function slugOf(url) {
    var m = /\/(?:work|play)\/([^\/.]+)\.html/.exec(url || "");
    return m ? m[1] : null;
  }
  function mediaFor(slug) {
    return slug ? document.querySelector('.card[data-slug="' + slug + '"] .card-media') : null;
  }
  function name(el, slug, vt) {
    if (!el || !vt) return;
    el.style.viewTransitionName = "hero-" + slug;
    vt.finished.finally(function () { el.style.viewTransitionName = ""; });
  }

  // leaving the home page: name the card being opened
  window.addEventListener("pageswap", function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var slug = slugOf(e.activation.entry.url);
    name(mediaFor(slug), slug, e.viewTransition);
  });

  // arriving on the home page from a case study: name the card it came from
  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var slug = slugOf(navigation.activation.from.url);
    name(mediaFor(slug), slug, e.viewTransition);
  });
})();


/* ---------- 6. mini player ------------------------------------------------
   A YouTube playlist behind a slim bar. Nothing from YouTube loads until the
   first press of play, and nothing autoplays. Set the playlist id on the
   #miniplayer element (data-playlist); with no id the bar stays hidden.
   Songs can be reordered or swapped on YouTube without touching this file. */

(function () {
  var bar = document.getElementById("miniplayer");
  if (!bar) return;
  var id = (bar.getAttribute("data-playlist") || "").trim();
  if (!id) return;

  bar.hidden = false;
  document.body.classList.add("has-miniplayer");

  var playBtn = bar.querySelector(".mp-play");
  var nextBtn = bar.querySelector(".mp-next");
  var titleEl = bar.querySelector(".mp-title");
  var player = null, loading = false, wantPlay = false, stallTimer = null;
  var playlistUrl = "https://www.youtube.com/playlist?list=" + encodeURIComponent(id);

  function setPlaying(on) {
    bar.classList.toggle("is-playing", on);
    playBtn.setAttribute("aria-label", on ? "Pause katalina island radio" : "Play katalina island radio");
  }
  function setTitle() {
    try {
      var d = player.getVideoData();
      if (d && d.title) titleEl.textContent = d.title;
    } catch (e) {}
  }

  // if nothing starts within a few seconds (blocked embed, ad blocker, slow
  // connection), say so and offer the playlist on YouTube instead of hanging
  function watchForStall() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(function () {
      var state = -1;
      try { state = player.getPlayerState(); } catch (e) {}
      if (state === 1) return;
      titleEl.textContent = "";
      var a = document.createElement("a");
      a.href = playlistUrl; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Trouble playing? Open on YouTube";
      titleEl.appendChild(a);
      setPlaying(false);
    }, 9000);
  }

  function build() {
    player = new YT.Player("mp-yt", {
      width: "96", height: "54",
      playerVars: {
        listType: "playlist", list: id,
        autoplay: wantPlay ? 1 : 0,
        playsinline: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3,
        origin: window.location.origin
      },
      events: {
        onReady: function () {
          bar.classList.add("is-ready");
          setTitle();
          if (wantPlay) { player.playVideo(); watchForStall(); }
        },
        onStateChange: function (e) {
          setPlaying(e.data === 1 || e.data === 3);
          setTitle();
          if (e.data === 1) clearTimeout(stallTimer);
          else if (e.data === 3) watchForStall();
        },
        onError: function () {          // a song that can't be embedded: move on
          try { player.nextVideo(); } catch (err) {}
        }
      }
    });
  }

  function load() {
    if (loading) return;
    loading = true;
    titleEl.textContent = "Loading…";
    window.onYouTubeIframeAPIReady = build;
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  playBtn.addEventListener("click", function () {
    if (!player) { wantPlay = true; load(); return; }
    if (!player.getPlayerState) return;
    if (player.getPlayerState() === 1) player.pauseVideo();
    else { player.playVideo(); watchForStall(); }
  });
  nextBtn.addEventListener("click", function () {
    if (!player) { wantPlay = true; load(); return; }
    player.nextVideo();
  });
})();


/* ---------- 7. braille status glyph ------------------------------------------
   The same dots the old island was drawn with, turning like a tiny spinner next
   to "open to new projects". Holds still for people who ask for less motion. */

(function () {
  var el = document.querySelector(".braille");
  if (!el) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var frames = ["\u28FE", "\u28FD", "\u28FB", "\u28BF", "\u287F", "\u28DF", "\u28EF", "\u28F7"];
  var i = 0;
  setInterval(function () {
    if (document.hidden) return;
    i = (i + 1) % frames.length;
    el.textContent = frames[i];
  }, 130);
})();


/* ---------- 8. copy email ----------------------------------------------------
   Same behaviour as the row it was modelled on: click, the address is copied,
   the label reads "Copied Email" with a green check for a couple of seconds. */

(function () {
  var btns = document.querySelectorAll(".copy-email");
  if (!btns.length) return;

  Array.prototype.forEach.call(btns, function (btn) {
    var email = btn.getAttribute("data-email");
    var label = btn.querySelector(".ce-label");
    var rest = label ? label.textContent : "copy email";
    var status = btn.parentNode.querySelector("[data-copy-status]");
    var timer = null;

    function done() {
      btn.classList.add("is-copied");
      if (label) label.textContent = "copied";
      if (status) status.textContent = "Email address copied";
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.classList.remove("is-copied");
        if (label) label.textContent = rest;
        if (status) status.textContent = "";
      }, 2000);
    }

    btn.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, function () {
          window.location.href = "mailto:" + email;
        });
      } else {
        window.location.href = "mailto:" + email;
      }
    });
  });
})();


/* ---------- 9. reveal on scroll ---------------------------------------------- */

(function () {
  [].forEach.call(document.querySelectorAll(".shot:not(.hero)"), function (el) { el.classList.add("reveal"); });
  var items = [].slice.call(document.querySelectorAll(".reveal"));
  if (!items.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  items.forEach(function (el, n) {
    // a small stagger between neighbours that arrive together
    el.style.setProperty("--d", (n % 2) * 90 + "ms");
    io.observe(el);
  });
})();


/* ---------------------------------------------------------------
   10. Smooth scroll for the left nav
   CSS smooth scrolling switches itself off for anyone whose computer is set
   to "reduce motion", which made the nav jump. A click on the nav is one
   short, deliberate move, so it glides either way. Everything else on the
   page still respects reduced motion.
   --------------------------------------------------------------- */
(function () {
  var links = document.querySelectorAll('.sidenav a[href^="#"], .rail-sections a[href^="#"]');
  if (!links.length) return;

  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();

      var offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      var start = window.pageYOffset;
      var end = Math.max(0, target.getBoundingClientRect().top + start - offset);
      var dist = end - start;
      var dur = Math.min(900, Math.max(450, Math.abs(dist) * 0.35));
      var t0 = null;

      document.documentElement.style.scrollBehavior = "auto";
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        window.scrollTo(0, start + dist * ease(p));
        if (p < 1) requestAnimationFrame(step);
        else {
          document.documentElement.style.scrollBehavior = "";
          if (history.replaceState) history.replaceState(null, "", "#" + id);
        }
      }
      requestAnimationFrame(step);
    });
  });
})();


/* ---------------------------------------------------------------
   11. Reading progress on case studies: a thin neon line at the top
   --------------------------------------------------------------- */
(function () {
  var bar = document.createElement("div");
  bar.className = "progress"; bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = "<i></i>";
  document.body.appendChild(bar);
  var fill = bar.firstChild, busy = false;
  function update() {
    busy = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.pageYOffset / max) : 0) + ")";
  }
  window.addEventListener("scroll", function () { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();


/* ---------------------------------------------------------------
   12. Hover peek: a small preview of the project follows the pointer
   --------------------------------------------------------------- */
(function () {
  var cards = document.querySelectorAll(".card");
  if (!cards.length || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var peek = document.createElement("div");
  peek.className = "peek"; peek.setAttribute("aria-hidden", "true");
  var img = document.createElement("img"); img.alt = ""; peek.appendChild(img);
  document.body.appendChild(peek);
  var x = 0, y = 0, tx = 0, ty = 0, raf = 0;
  function loop() {
    x += (tx - x) * 0.2; y += (ty - y) * 0.2;
    peek.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    raf = peek.classList.contains("is-on") ? requestAnimationFrame(loop) : 0;
  }
  function place(e) {
    var w = peek.offsetWidth || 240, h = peek.offsetHeight || 180;
    var col = document.querySelector(".plain");
    var right = col ? col.getBoundingClientRect().right + 20 : e.clientX + 28;
    tx = right + w + 16 <= window.innerWidth ? right : Math.min(e.clientX + 28, window.innerWidth - w - 16);
    ty = Math.min(Math.max(e.clientY - h / 2, 16), window.innerHeight - h - 16);
  }
  [].forEach.call(cards, function (card, n) {
    var src = card.querySelector(".card-media img");
    if (!src) return;
    card.addEventListener("mouseenter", function (e) {
      peek.className = "peek";
      peek.style.borderColor = getComputedStyle(card).getPropertyValue("--hl") || "";
      img.src = src.currentSrc || src.src;
      place(e); x = tx; y = ty;
      peek.classList.add("is-on");
      if (!raf) raf = requestAnimationFrame(loop);
    });
    card.addEventListener("mousemove", place);
    card.addEventListener("mouseleave", function () { peek.classList.remove("is-on"); });
  });
})();


/* ---------------------------------------------------------------
   13. Artifacts slideshow: one image at a time, arrows, thumbnails, swipe
   --------------------------------------------------------------- */
(function () {
  var wrap = document.querySelector(".shots[data-artifacts]");
  if (!wrap) return;
  var figs = [].slice.call(wrap.querySelectorAll(":scope > .shot"));
  if (figs.length < 2) return;

  figs.forEach(function (f) { f.classList.remove("reveal", "is-in"); });
  wrap.classList.add("is-slideshow");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-roledescription", "slideshow");
  wrap.setAttribute("aria-label", "Project artifacts");
  wrap.tabIndex = 0;

  var bar = document.createElement("div");
  bar.className = "ss-bar";
  bar.innerHTML =
    '<button type="button" class="ss-btn ss-prev" aria-label="Previous image">&larr;</button>' +
    '<span class="ss-count" aria-live="polite"></span>' +
    '<button type="button" class="ss-btn ss-next" aria-label="Next image">&rarr;</button>';
  wrap.insertBefore(bar, wrap.firstChild);

  var stage = document.createElement("div");
  stage.className = "ss-stage";
  figs.forEach(function (f) { stage.appendChild(f); });
  bar.after(stage);

  var thumbs = document.createElement("div");
  thumbs.className = "ss-thumbs";
  figs.forEach(function (f, i) {
    var src = f.querySelector("img");
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ss-thumb";
    b.setAttribute("aria-label", "Show image " + (i + 1));
    if (src) { var t = document.createElement("img"); t.src = src.currentSrc || src.src; t.alt = ""; t.loading = "lazy"; b.appendChild(t); }
    b.addEventListener("click", function () { go(i); });
    thumbs.appendChild(b);
  });
  wrap.appendChild(thumbs);

  var count = bar.querySelector(".ss-count");
  var cur = 0;
  function go(n) {
    cur = (n + figs.length) % figs.length;
    figs.forEach(function (f, i) { f.hidden = i !== cur; });
    [].forEach.call(thumbs.children, function (b, i) {
      if (i === cur) { b.setAttribute("aria-current", "true"); b.scrollIntoView && thumbs.scrollTo({ left: b.offsetLeft - thumbs.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" }); }
      else b.removeAttribute("aria-current");
    });
    count.textContent = String(cur + 1).padStart(2, "0") + " / " + String(figs.length).padStart(2, "0");
    var next = figs[(cur + 1) % figs.length].querySelector("img");
    if (next) next.loading = "eager";
  }
  bar.querySelector(".ss-prev").addEventListener("click", function () { go(cur - 1); });
  bar.querySelector(".ss-next").addEventListener("click", function () { go(cur + 1); });
  wrap.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { go(cur - 1); e.preventDefault(); }
    if (e.key === "ArrowRight") { go(cur + 1); e.preventDefault(); }
  });
  var sx = null;
  stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  go(0);
})();


/* ---------------------------------------------------------------
   14. Peek words: hover (or tap) a word to see a photo and caption
   The words and their photos live in index.html: <span data-peek="key"> in the
   copy, and a JSON block (#peek-data) with the photos for each key. Several
   photos per key is fine; each new hover shows the next one.
   A word only becomes interactive once its first photo has loaded, so a word
   with no photo yet stays plain text and nothing looks broken.
   Mouse: hover. Keyboard: focus (Enter shows the next photo, Esc closes).
   Touch: tap to open, tap again or tap anywhere else to close.
   --------------------------------------------------------------- */
(function () {
  var spans = [].slice.call(document.querySelectorAll("[data-peek]"));
  var dataEl = document.getElementById("peek-data");
  if (!spans.length || !dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var card = document.createElement("figure");
  card.className = "peek-card"; card.setAttribute("aria-hidden", "true");
  var img = document.createElement("img"); img.alt = ""; img.decoding = "async";
  var cap = document.createElement("figcaption");
  card.appendChild(img); card.appendChild(cap);
  var live = document.createElement("div");
  live.className = "sr-only"; live.setAttribute("role", "status");
  document.body.appendChild(card); document.body.appendChild(live);

  // open index.html#peekdemo to preview with stand-in pictures before real photos exist
  var DEMO = window.location.hash === "#peekdemo";
  var current = null, openedBy = "mouse", lastType = "mouse", y0 = 0, token = 0;
  var dockQuery = window.matchMedia("(max-width: 48rem), (hover: none)");

  function preload(p, done) {
    if (p.state === "ok") return done(true);
    if (p.state === "bad") return done(false);
    var im = new Image();
    im.onload = function () { p.state = "ok"; done(true); };
    im.onerror = function () {
      if (DEMO) {                                          // preview mode: stand-in picture
        var label = (p.cap || "photo").replace(/[<>&"]/g, "");
        p.src = "data:image/svg+xml;utf8," + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#ffd6e8"/>' +
          '<text x="400" y="400" font-family="Georgia,serif" font-size="56" text-anchor="middle" fill="#111">your photo here</text>' +
          '<text x="400" y="470" font-family="Georgia,serif" font-size="36" text-anchor="middle" fill="#555">' + label + '</text></svg>');
        p.state = "ok"; return done(true);
      }
      p.state = "bad"; done(false);
    };
    im.src = p.src;
  }

  // drop photos from the front of the list until one loads
  function firstGood(item, done) {
    (function t() {
      if (!item.photos.length) return done(false);
      preload(item.photos[0], function (ok) {
        if (ok) return done(true);
        item.photos.shift(); t();
      });
    })();
  }

  function hide() {
    token++;
    if (current) { current.classList.remove("is-open"); current.setAttribute("aria-expanded", "false"); }
    current = null;
    card.classList.remove("is-on");
    live.textContent = "";
  }

  // advance = show the next photo of the word that is already open
  function show(btn, how, advance) {
    if (current === btn && !advance) return;
    var item = btn._peek;
    var mine = ++token;
    var tries = item.photos.length;

    (function next() {
      if (!tries--) return;
      var i = (item.i + 1) % item.photos.length;
      var p = item.photos[i];
      preload(p, function (ok) {
        if (mine !== token) return;                       // moved on to something else
        if (!ok) { item.i = i; return next(); }           // a missing photo: skip it
        item.i = i;

        if (current && current !== btn) {
          current.classList.remove("is-open"); current.setAttribute("aria-expanded", "false");
        }
        current = btn; openedBy = how; y0 = window.pageYOffset;
        btn.classList.add("is-open"); btn.setAttribute("aria-expanded", "true");

        img.src = p.src;
        img.style.objectPosition = p.pos || "";
        cap.textContent = p.cap || "";
        live.textContent = p.cap || "";
        card.style.setProperty("--pf", "var(--f-" + item.color + ")");
        card.style.setProperty("--tilt", item.tilt + "deg");

        // docked layout: if the card would cover the word, flip it to the top
        var flip = false;
        if (dockQuery.matches) {
          var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          var top = window.innerHeight - rem * 6.5 - (card.offsetHeight || 260);
          flip = btn.getBoundingClientRect().bottom > top - 8;
        }
        card.classList.toggle("at-top", flip);
        card.classList.add("is-on");

        // warm up the next photo so the following hover is instant
        if (item.photos.length > 1) preload(item.photos[(i + 1) % item.photos.length], function () {});
      });
    })();
  }

  function upgrade(span) {
    var item = data[span.getAttribute("data-peek")];
    if (!item || !item._ok) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "peek-word pw-" + item.color;
    b.textContent = span.textContent;
    b.setAttribute("aria-expanded", "false");
    b._peek = item;

    b.addEventListener("pointerdown", function (e) { lastType = e.pointerType || "mouse"; });
    b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") show(b, "mouse"); });
    b.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && current === b) hide(); });
    b.addEventListener("focus", function () { if (b.matches(":focus-visible")) show(b, "key"); });
    b.addEventListener("blur", function () { if (current === b) hide(); });
    b.addEventListener("click", function (e) {
      if (e.detail === 0) { show(b, "key", true); return; }   // Enter / Space: next photo
      if (lastType === "mouse") return;                        // hover already showed it
      if (current === b) hide(); else show(b, "touch");
    });
    span.replaceWith(b);
  }

  // find out which keys actually have a photo, then upgrade their words
  var keys = {};
  spans.forEach(function (s) { var k = s.getAttribute("data-peek"); (keys[k] = keys[k] || []).push(s); });
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
  idle(function () {
    Object.keys(keys).forEach(function (k) {
      var item = data[k];
      if (!item || !item.photos || !item.photos.length) return;
      item.photos.forEach(function (p) { p.state = ""; });
      item.color = item.color || "cyan";
      item.tilt = item.tilt || -2;
      item.i = -1;
      firstGood(item, function (ok) {
        if (!ok) return;
        item._ok = true;
        keys[k].forEach(upgrade);
      });
    });
  });

  document.addEventListener("pointerdown", function (e) {
    if (current && !(e.target.closest && e.target.closest(".peek-word"))) hide();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  window.addEventListener("resize", hide);
  window.addEventListener("scroll", function () {
    if (current && openedBy !== "key" && Math.abs(window.pageYOffset - y0) > 40) hide();
  }, { passive: true });
})();


/* ---------- animated favicon ------------------------------------------------------
   The k tile drifts through the site's neon palette. An animated GIF favicon only
   animates in Firefox, so this redraws a small canvas instead, which works in every
   browser. Honors prefers-reduced-motion; the static PNG/SVG stays the fallback. */
(function () {
  var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!mq || mq.matches) return;
  if (typeof Path2D === "undefined") return;
  var cv = document.createElement("canvas");
  var ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) return;

  var SIZE = 64, R = 15.4;
  cv.width = cv.height = SIZE;
  var u = SIZE / 100;                       /* the mark is drawn in a 100 unit box */
  var K = new Path2D("M766.3 535.4 872.4 710 1309.7 149.2 1430.9 98.5V0H966.4V98.5L965.8 117L683.8 481.3H419.4V664.3H701.5L959.6 899.5L805.9 933.8V1032.5H1358V933.8L1205.1 900.4ZM525.4 142.8 668.1 105.8V0H61.6V105.8L209.5 142.8V1206.1Q196.5 1212.8 163.1 1228.8Q129.7 1244.8 87.3 1265.1Q44.9 1285.4 5.9 1304.9V1406.4L472 1488.2H547.9L525.4 1242.4Z");
  var KS = 0.038972, KTX = 22.002, KTY = 79.000;
  var INK = "#141416";
  var PAL = [[200, 228, 74], [62, 224, 196], [95, 208, 240], [167, 139, 250], [255, 90, 165], [255, 90, 71], [255, 147, 64]];

  var SEG = 4200;                           /* ms per colour, so a full lap is ~29s */
  var STEP = 500;                           /* ms between redraws, 2fps is plenty */
  var link = null, timer = null;

  function mix(a, b, t) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," +
                    Math.round(a[1] + (b[1] - a[1]) * t) + "," +
                    Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }

  function draw(now) {
    var pos = (now % (SEG * PAL.length)) / SEG;
    var i = Math.floor(pos), t = pos - i;
    var a = mix(PAL[i % PAL.length], PAL[(i + 1) % PAL.length], t);
    var b = mix(PAL[(i + 1) % PAL.length], PAL[(i + 2) % PAL.length], t);

    ctx.clearRect(0, 0, SIZE, SIZE);
    var grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(0, 0, SIZE, SIZE, R); } else { ctx.rect(0, 0, SIZE, SIZE); }
    ctx.fill();

    ctx.save();
    ctx.setTransform(KS * u, 0, 0, -KS * u, KTX * u, KTY * u);
    ctx.fillStyle = INK;
    ctx.fill(K);
    ctx.restore();

    if (!link) {
      var old = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      document.head.appendChild(link);
      for (var j = 0; j < old.length; j++) old[j].parentNode.removeChild(old[j]);
    }
    link.href = cv.toDataURL("image/png");
  }

  function tick() { draw(performance.now()); }

  tick();
  timer = setInterval(tick, STEP);
  if (mq.addEventListener) {
    mq.addEventListener("change", function (e) {
      if (e.matches && timer) { clearInterval(timer); timer = null; }
    });
  }
})();
