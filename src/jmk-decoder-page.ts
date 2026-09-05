// Standalone .jmk decoder page. Entirely client-side: a selected/dropped
// file or pasted hex string is decoded in-memory and never leaves the
// browser — no fetch(), no analytics on file content, nothing sent
// anywhere. See profiles/jmk-import.ts for the actual decode logic; this
// file is just input handling, validation, and safe rendering.
import { decodeJmkButtonTable, type JmkButtonMapping } from "./profiles/jmk-import";

// Real .jmk exports are ~11KB. Capped generously above that to reject an
// oversized "fake .jmk" before it's ever read into memory, rather than
// trusting file size implicitly.
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_HEX_TEXT_CHARS = MAX_FILE_BYTES * 3; // generous allowance for whitespace between hex pairs
// The button table's last byte is at offset 1081 (12 records of 40 bytes
// starting at 640) — anything shorter can't be a real button table, so
// reject it up front with a clear message instead of silently returning
// "no mappings found".
const MIN_VALID_BYTES = 1082;

const dropZone = document.querySelector<HTMLDivElement>("#drop-zone")!;
const pickFileBtn = document.querySelector<HTMLButtonElement>("#pick-file-btn")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const hexInput = document.querySelector<HTMLTextAreaElement>("#hex-input")!;
const decodeHexBtn = document.querySelector<HTMLButtonElement>("#decode-hex-btn")!;
const errorEl = document.querySelector<HTMLDivElement>("#error-message")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;
const resultsBody = document.querySelector<HTMLTableSectionElement>("#results-body")!;
const resultsSummary = document.querySelector<HTMLParagraphElement>("#results-summary")!;

function showError(message: string) {
  errorEl.textContent = message; // textContent only — never innerHTML with user-derived text
  errorEl.hidden = false;
  resultsEl.style.display = "none";
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

// Purely cosmetic formatting of an already-safe, fixed-vocabulary action
// token (e.g. "ctrl+shift+tab" -> "Ctrl+Shift+Tab"). Still rendered via
// textContent below regardless — this never touches innerHTML.
function formatAction(action: string): string {
  return action
    .split("+")
    .map((token) => (token === "super" ? "Cmd/Win" : token.charAt(0).toUpperCase() + token.slice(1)))
    .join(" + ");
}

function renderResults(mappings: JmkButtonMapping[]) {
  resultsBody.replaceChildren(); // clear safely, no innerHTML

  let decodedCount = 0;
  for (const { index, action } of mappings) {
    const row = document.createElement("tr");

    const buttonCell = document.createElement("td");
    buttonCell.textContent = `Side Button ${index}`;

    const actionCell = document.createElement("td");
    if (action) {
      actionCell.textContent = formatAction(action);
      decodedCount++;
    } else {
      actionCell.textContent = "(not decoded — unmapped or a custom macro)";
      actionCell.style.color = "var(--text-secondary)";
    }

    row.append(buttonCell, actionCell);
    resultsBody.append(row);
  }

  resultsSummary.textContent = `${decodedCount} of ${mappings.length} button slots decoded.`;
  resultsEl.style.display = "block";
}

function decodeAndRender(bytes: Uint8Array) {
  clearError();
  if (bytes.length < MIN_VALID_BYTES) {
    showError(
      `This file is only ${bytes.length} bytes — too short to be a valid .jmk profile (expected at least ${MIN_VALID_BYTES}).`
    );
    return;
  }
  try {
    const mappings = decodeJmkButtonTable(bytes);
    renderResults(mappings);
  } catch {
    // Decoding is pure array indexing today and shouldn't throw, but a
    // corrupted/unexpected file is exactly the kind of input this page
    // exists to accept — never let it crash the page.
    showError("Couldn't parse this file as a .jmk profile.");
  }
}

async function handleFile(file: File) {
  clearError();
  if (file.size > MAX_FILE_BYTES) {
    showError(`File is too large (${Math.round(file.size / 1024)} KB) — a real .jmk profile is around 11 KB.`);
    return;
  }
  if (file.size === 0) {
    showError("That file is empty.");
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  decodeAndRender(bytes);
}

// --- File picker ---
pickFileBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void handleFile(file);
});

// --- Drag and drop ---
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

// --- Paste-hex path ---
decodeHexBtn.addEventListener("click", () => {
  clearError();
  const raw = hexInput.value;

  if (raw.length > MAX_HEX_TEXT_CHARS) {
    showError("That's too much text to be a .jmk file's hex — check what you pasted.");
    return;
  }

  const stripped = raw.replace(/\s+/g, "");
  if (stripped.length === 0) {
    showError("Paste some hex bytes first.");
    return;
  }
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    showError("That doesn't look like valid hex — only 0-9 and a-f are allowed (whitespace is fine).");
    return;
  }
  if (stripped.length % 2 !== 0) {
    showError("Odd number of hex digits — bytes need two hex digits each.");
    return;
  }

  const byteCount = stripped.length / 2;
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16);
  }
  decodeAndRender(bytes);
});
