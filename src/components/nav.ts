import { el } from "../lib/dom";
import type { Exam } from "../lib/types";
import { dot } from "./exam-grid";

/** Views are driven by the URL hash: "" / #countdown, #module=<exam id>, or #general. */
export type Route = { view: "countdown" } | { view: "module"; id: string } | { view: "general" };

export function currentRoute(): Route {
  if (location.hash === "#general") return { view: "general" };
  const id = new URLSearchParams(location.hash.slice(1)).get("module");
  return id ? { view: "module", id } : { view: "countdown" };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Fills the Modules panel; called whenever exams change. */
export function renderModulesMenu(exams: Exam[]): void {
  const ids = exams.map((e) => e.id);
  const route = currentRoute();
  const sorted = [...exams].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.module.localeCompare(b.module));
  const general = el("a", "modules-menu__item modules-menu__item--general", "General links");
  general.href = "#general";
  const generalLi = el("li", "modules-menu__general");
  generalLi.append(general);
  $("modules-menu-list").replaceChildren(
    ...sorted.map((exam) => {
      const a = el("a", "modules-menu__item");
      a.href = `#module=${encodeURIComponent(exam.id)}`;
      a.append(dot(exam, ids), document.createTextNode(exam.module));
      if (route.view === "module" && route.id === exam.id) a.setAttribute("aria-current", "page");
      const li = el("li");
      li.append(a);
      return li;
    }),
    generalLi,
  );
}

/** Shows the view for the current hash and marks the matching nav item. */
export function applyRoute(route: Route): void {
  $("view-countdown").hidden = route.view !== "countdown";
  $("view-module").hidden = route.view !== "module";
  $("view-general").hidden = route.view !== "general";
  const countdownLink = document.querySelector('.pill-nav a[href="#countdown"]')!;
  if (route.view === "countdown") countdownLink.setAttribute("aria-current", "page");
  else countdownLink.removeAttribute("aria-current");
  $("modules-toggle").classList.toggle("is-active", route.view !== "countdown");
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(".modules-menu__item"))) {
    const match =
      (route.view === "module" && a.hash === `#module=${encodeURIComponent(route.id)}`) ||
      (route.view === "general" && a.hash === "#general");
    if (match) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

/** Disclosure for the Modules panel: toggle, Esc, click outside, close after picking. */
export function initModulesMenu(): void {
  const toggle = $("modules-toggle");
  const panel = $("modules-menu");
  const setOpen = (open: boolean) => {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    if (open) panel.querySelector<HTMLElement>("a")?.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !(e.target as Element).closest("#modules-menu, #modules-toggle")) setOpen(false);
  });
  window.addEventListener("hashchange", () => setOpen(false));
}
