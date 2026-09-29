// Theme switch. The <html data-theme> attribute is already set by the
// inline script in every <head> (before first paint, so there's no flash);
// this only wires the visible control in the site nav and persists the
// choice. Kept in its own module so no page's logic has to know about it.
const KEY = "mouseconfig.theme";
type Theme = "play" | "pro";

function store(theme: Theme) {
  // Private mode and blocked site data both throw here; the switch still
  // works for the session, it just won't be remembered.
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* not fatal */
  }
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "play" || v === "pro" ? v : null;
  } catch {
    return null;
  }
}

export function initThemeToggle() {
  const group = document.querySelector<HTMLElement>(".theme-switch");
  if (!group) return;
  const options = [...group.querySelectorAll<HTMLButtonElement>("button[data-theme-value]")];
  if (!options.length) return;

  const current = () => (document.documentElement.getAttribute("data-theme") === "pro" ? "pro" : "play");

  // Roving tabindex: the radio group is one tab stop, arrows move within it.
  function reflect() {
    const active = current();
    for (const option of options) {
      const selected = option.dataset.themeValue === active;
      option.setAttribute("aria-checked", String(selected));
      option.tabIndex = selected ? 0 : -1;
    }
  }

  function select(theme: Theme, focus: boolean) {
    document.documentElement.setAttribute("data-theme", theme);
    store(theme);
    reflect();
    if (focus) options.find((o) => o.dataset.themeValue === theme)?.focus();
  }

  for (const option of options) {
    option.addEventListener("click", () => select(option.dataset.themeValue as Theme, false));
  }

  group.addEventListener("keydown", (event) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((o) => o.dataset.themeValue === current());
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? options.length - 1
      : event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % options.length
      : (index - 1 + options.length) % options.length;
    select(options[next]!.dataset.themeValue as Theme, true);
  });

  // No stored choice yet? Keep following the OS if it changes mid-session.
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    if (stored()) return;
    document.documentElement.setAttribute("data-theme", event.matches ? "pro" : "play");
    reflect();
  });

  reflect();
}

initThemeToggle();
