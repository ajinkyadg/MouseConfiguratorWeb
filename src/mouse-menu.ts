// The "Mouse" picker is a <details> disclosure of plain links, so it works
// (and is crawlable) without JS. This only adds the dropdown conveniences
// a native <details> lacks: close on outside click, on Escape, and when
// focus leaves it.
export function initMouseMenu() {
  const menu = document.querySelector<HTMLDetailsElement>("#mouse-menu");
  if (!menu) return;
  const summary = menu.querySelector("summary")!;

  document.addEventListener("click", (e) => {
    if (menu.open && !menu.contains(e.target as Node)) menu.open = false;
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  menu.addEventListener("focusout", (e) => {
    if (menu.open && !menu.contains(e.relatedTarget as Node | null)) menu.open = false;
  });
}
