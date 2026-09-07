/* katalinavasquez.com — three small things:
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
        var pick = targets[0];

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
          if (current) current.link.classList.remove("is-active");
          pick.link.classList.add("is-active");
          pick.link.setAttribute("aria-current", "true");
          if (current) current.link.removeAttribute("aria-current");
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
