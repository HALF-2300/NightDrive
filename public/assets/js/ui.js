/* ========================================
   AutoElite — Dark Predator UI Helpers
   v4.0 — Predator Mode
   ======================================== */

(function () {
  var nav = document.querySelector(".navbar");
  if (!nav) return;

  function onScroll() {
    if (window.scrollY > 8) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
