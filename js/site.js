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
    var effectiveDark = current !== "light";
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
  var btn = document.querySelector(".copy-email");
  if (!btn) return;
  var email = btn.getAttribute("data-email");
  var label = btn.querySelector(".ce-label");
  var status = document.querySelector("[data-copy-status]");
  var timer = null;

  function done() {
    btn.classList.add("is-copied");
    label.textContent = "Copied Email";
    if (status) status.textContent = "Email address copied";
    clearTimeout(timer);
    timer = setTimeout(function () {
      btn.classList.remove("is-copied");
      label.textContent = "Copy Email";
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
   11. Reading progress on case studies: a thin pink line at the top
   --------------------------------------------------------------- */
(function () {
  if (document.body.hasAttribute("data-home")) return;
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
