// Dropdowns (the top nav menus and the "Mouse" picker) are <details>
// disclosures of plain links, so they work — and are crawlable — without
// JS. This adds what a native <details> lacks: only one open at a time,
// and closing on an outside click, on Escape, or when focus leaves.
export function initDropdowns() {
  const menus = [...document.querySelectorAll<HTMLDetailsElement>("details.dropdown")];

  for (const menu of menus) {
    const summary = menu.querySelector("summary")!;
    menu.addEventListener("toggle", () => {
      if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
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

  document.addEventListener("click", (e) => {
    for (const menu of menus) if (menu.open && !menu.contains(e.target as Node)) menu.open = false;
  });
}
