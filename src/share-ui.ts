// Browser-side helpers for share links (see profiles/share-link.ts).

/** Copies the link, falling back to a prompt the user can copy from. */
export async function copyShareLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt("Copy this link to share the profile:", url);
    return false;
  }
}

// Once a shared profile has been handled, drop it from the address bar so
// a reload or bookmark doesn't offer it again.
export function clearShareFragment(): void {
  history.replaceState(null, "", location.pathname + location.search);
}
