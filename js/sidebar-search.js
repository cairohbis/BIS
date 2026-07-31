/* ══════════════════════════════════════════
   js/sidebar-search.js — تبديل بحث الشريط الجانبي
   منقول من index.html بدون أي تغيير في المنطق —
   القسم ده مستقل تماماً (صفر اعتماد على db/auth/currentUser).
══════════════════════════════════════════ */
function toggleSidebarSearch() {
  const header = document.getElementById("sidebarHeader");
  if (!header) return;
  const isOpen = header.classList.contains("search-open");
  if (isOpen) {
    closeSidebarSearch();
  } else {
    header.classList.add("search-open");
    setTimeout(() => {
      document.getElementById("sidebarHeaderSearchInp")?.focus();
    }, 200);
  }
}
function closeSidebarSearch() {
  const header = document.getElementById("sidebarHeader");
  if (!header) return;
  header.classList.remove("search-open");
  const inp = document.getElementById("sidebarHeaderSearchInp");
  if (inp) inp.value = "";
}
window.toggleSidebarSearch = toggleSidebarSearch;
window.closeSidebarSearch  = closeSidebarSearch;
