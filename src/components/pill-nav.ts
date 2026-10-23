/** Switches between the views listed in the nav, driven by the URL hash. */
export type ViewId = "countdown" | "resources";
const VIEWS: ViewId[] = ["countdown", "resources"];

function currentView(): ViewId {
  const hash = location.hash.slice(1);
  return (VIEWS as string[]).includes(hash) ? (hash as ViewId) : "countdown";
}

function show(view: ViewId): void {
  for (const id of VIEWS) {
    document.getElementById(`view-${id}`)!.hidden = id !== view;
    const link = document.querySelector(`.pill-nav a[href="#${id}"]`);
    if (id === view) link?.setAttribute("aria-current", "page");
    else link?.removeAttribute("aria-current");
  }
}

export function initPillNav(): void {
  show(currentView());
  window.addEventListener("hashchange", () => show(currentView()));
}
