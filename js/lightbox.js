/* ══════════════════════════════════════════
   js/lightbox.js — عرض الصور بالتكبير (Lightbox)
══════════════════════════════════════════ */
window.openLightbox = function(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.add("show");
};

