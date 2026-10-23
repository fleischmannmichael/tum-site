/** Applies the user's accent (or the default when unset) to the page's tokens. */
export function applyAccent(accent: string | undefined): void {
  const root = document.documentElement.style;
  if (accent) root.setProperty("--color-accent", accent);
  else root.removeProperty("--color-accent");
}
