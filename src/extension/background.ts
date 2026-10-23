// Extension service worker: keeps the toolbar badge (days to the next exam) current.
import { badgeFor, nextMidnight } from "../lib/badge";
import { setLang } from "../lib/i18n";
import { loadAll } from "../lib/storage";

// Match tokens.css (--color-accent-default, --color-warm, --color-bg); a worker can't read CSS.
const ACCENT_DEFAULT = "#6aa8ec";
const WARM = "#f2b366";
const INK = "#0b0f1a";

async function updateBadge(): Promise<void> {
  const data = await loadAll();
  setLang(data.settings.language);
  const now = Date.now();
  const badge = badgeFor(data.exams, now);
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.kind === "normal" ? (data.settings.accent ?? ACCENT_DEFAULT) : WARM });
  await chrome.action.setBadgeTextColor?.({ color: INK }); // Chrome 110+
  await chrome.action.setTitle({ title: badge.title });
  // Day counts change at midnight: wake up right after it.
  await chrome.alarms.create("midnight", { when: nextMidnight(now) + 5_000 });
}

// Listeners must be registered at the top level so they survive worker restarts.
chrome.runtime.onInstalled.addListener(() => void updateBadge());
chrome.runtime.onStartup.addListener(() => void updateBadge());
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") void updateBadge();
});
chrome.alarms.onAlarm.addListener(() => void updateBadge());
void chrome.alarms.create("refresh", { periodInMinutes: 30 }); // safety net
