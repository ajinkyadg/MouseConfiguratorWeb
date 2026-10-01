// Phones, tablets, Safari and Firefox have no WebHID, so Connect can never
// work there. Rather than leave a dead primary button, swap it for the one
// thing that helps: getting this page onto a computer running Chrome or Edge
// — the share sheet where there is one (email/AirDrop it to yourself), a
// copy-link button otherwise.
export function offerDesktopHandoff(connectBtn: HTMLButtonElement) {
  const handoff = document.createElement("button");
  handoff.type = "button";
  handoff.className = "primary handoff";
  // Desktop Safari has a share sheet too, but "send to my computer" makes no
  // sense there — offer it only on touch devices.
  const canShare = typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;
  handoff.textContent = canShare ? "Send this page to my computer" : "Copy link for Chrome or Edge";
  handoff.addEventListener("click", async () => {
    const url = location.href.split("#")[0]!;
    try {
      if (canShare) {
        await navigator.share({ title: document.title, text: "Open this in Chrome or Edge on a computer:", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      handoff.textContent = "Link copied — paste it into Chrome or Edge";
    } catch {
      // Share sheet dismissed, or clipboard blocked: nothing to undo.
    }
  });
  connectBtn.hidden = true;
  connectBtn.after(handoff);
}
