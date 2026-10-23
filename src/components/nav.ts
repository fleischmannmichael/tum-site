import { el } from "../lib/dom";
import { t } from "../lib/i18n";
import type { Exam } from "../lib/types";
import { dot } from "./exam-grid";

/** Views are driven by the URL hash: "" / #countdown, #modules, #module=<exam id>, #general or #focus. */
export type Route = { view: "countdown" } | { view: "modules" } | { view: "module"; id: string } | { view: "general" } | { view: "focus" };

export function currentRoute(): Route {
  if (location.hash === "#general") return { view: "general" };
  if (location.hash === "#modules") return { view: "modules" };
  if (location.hash === "#focus") return { view: "focus" };
  const id = new URLSearchParams(location.hash.slice(1)).get("module");
  return id ? { view: "module", id } : { view: "countdown" };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Exams grouped by module, in the order of the exam list (so related modules
 * like Analysis 1 and Linear Algebra stay together). Several exams of one
 * module (GOP, midterm) share one entry.
 */
export function modulesInOrder(exams: Exam[]): Exam[][] {
  const byModule = new Map<string, Exam[]>();
  for (const exam of exams) byModule.set(exam.module, [...(byModule.get(exam.module) ?? []), exam]);
  // Within a module, dated exams first (soonest first), then TBA.
  return [...byModule.values()].map((list) => [...list].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")));
}

/** Fills the hover list; called whenever exams change. */
export function renderModulesMenu(exams: Exam[]): void {
  const ids = exams.map((e) => e.id);
  const general = el("a", "modules-menu__item modules-menu__item--general", t("nav.general"));
  general.href = "#general";
  const generalLi = el("li", "modules-menu__general");
  generalLi.append(general);
  $("modules-menu-list").replaceChildren(
    ...modulesInOrder(exams).map((list) => {
      const first = list[0]!;
      const a = el("a", "modules-menu__item");
      a.href = `#module=${encodeURIComponent(first.id)}`;
      a.dataset.examIds = list.map((e) => e.id).join(" ");
      a.append(dot(first, ids), document.createTextNode(first.module));
      const li = el("li");
      li.append(a);
      return li;
    }),
    generalLi,
  );
}

/** Shows the view for the current hash and marks the matching nav item. */
export function applyRoute(route: Route): void {
  for (const view of ["countdown", "modules", "module", "general", "focus"] as const) $(`view-${view}`).hidden = route.view !== view;
  const focusLink = $("focus-link");
  if (route.view === "focus") focusLink.setAttribute("aria-current", "page");
  else focusLink.removeAttribute("aria-current");
  const countdownLink = document.querySelector('.pill-nav a[href="#countdown"]')!;
  if (route.view === "countdown") countdownLink.setAttribute("aria-current", "page");
  else countdownLink.removeAttribute("aria-current");
  const modulesLink = $("modules-link");
  modulesLink.classList.toggle("is-active", ["modules", "module", "general"].includes(route.view));
  if (route.view === "modules") modulesLink.setAttribute("aria-current", "page");
  else modulesLink.removeAttribute("aria-current");
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(".modules-menu__item"))) {
    const match =
      (route.view === "module" && (a.dataset.examIds ?? "").split(" ").includes(route.id)) ||
      (route.view === "general" && a.hash === "#general");
    if (match) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

/**
 * The quick list opens on hover and on keyboard focus (CSS). This only adds
 * ways to close it: Esc, or picking an entry, until the pointer/focus leaves.
 */
export function initModulesMenu(): void {
  const item = $("nav-modules");
  const close = () => item.setAttribute("data-closed", "");
  const reopen = () => item.removeAttribute("data-closed");
  item.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    close();
    $("modules-link").focus();
  });
  item.addEventListener("click", (e) => {
    if ((e.target as Element).closest("a")) close();
  });
  item.addEventListener("mouseleave", reopen);
  item.addEventListener("focusout", (e) => {
    if (!item.contains(e.relatedTarget as Node | null)) reopen();
  });
  // Pointer re-entering after a pick should open it again.
  item.addEventListener("mouseenter", () => {
    if (!item.contains(document.activeElement)) reopen();
  });
}
