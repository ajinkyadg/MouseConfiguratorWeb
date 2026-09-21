// Keeps each range input's filled track (--fill) and its <output for=…>
// readout in sync. Call syncRangeSliders() after setting .value in code
// (profile loads), since programmatic changes don't fire "input".

type RangeFormat = "percent" | "of-max" | "raw";

function format(el: HTMLInputElement): string {
  const value = Number(el.value);
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  switch (el.dataset.format as RangeFormat | undefined) {
    case "percent":
      return `${Math.round(((value - min) / (max - min)) * 100)}%`;
    case "of-max":
      return `${value} / ${max}`;
    default:
      return String(value);
  }
}

function sync(el: HTMLInputElement) {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  el.style.setProperty("--fill", `${((Number(el.value) - min) / (max - min)) * 100}%`);
  const text = format(el);
  el.setAttribute("aria-valuetext", text);
  const output = el.id ? document.querySelector<HTMLOutputElement>(`output[for="${el.id}"]`) : null;
  if (output) output.textContent = text;
}

export function syncRangeSliders() {
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(sync);
}

export function initRangeSliders() {
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((el) => {
    el.addEventListener("input", () => sync(el));
    sync(el);
  });
}
