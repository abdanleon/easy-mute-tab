function isWhitelisted(tabUrl, whitelist) {
  if (!tabUrl || !Array.isArray(whitelist) || whitelist.length === 0) {
    return false;
  }

  let parsedTabUrl;
  try {
    parsedTabUrl = new URL(tabUrl);
  } catch {
    return false;
  }

  const tabHost = parsedTabUrl.hostname.toLowerCase();
  const fullUrlLower = parsedTabUrl.href.toLowerCase();

  return whitelist.some((rawEntry) => {
    const entry = rawEntry.trim().toLowerCase();
    if (!entry) return false;

    // If the user entered a full URL with http/https protocol
    if (entry.startsWith("http://") || entry.startsWith("https://")) {
      try {
        const parsedEntry = new URL(entry);
        const sameHost =
          tabHost === parsedEntry.hostname.toLowerCase() ||
          tabHost.endsWith("." + parsedEntry.hostname.toLowerCase());

        if (!sameHost) return false;

        // Match the entire host when path is "/" or empty
        if (!parsedEntry.pathname || parsedEntry.pathname === "/") {
          return true;
        }
        return fullUrlLower.startsWith(parsedEntry.href.toLowerCase());
      } catch {
        return fullUrlLower.includes(entry);
      }
    }

    // If the user entered a domain or host+path without protocol (e.g., youtube.com)
    const cleanEntry = entry.replace(/^\/+|\/+$/g, "");
    const slashIndex = cleanEntry.indexOf("/");
    const entryHost = slashIndex === -1 ? cleanEntry : cleanEntry.slice(0, slashIndex);
    const entryPath = slashIndex === -1 ? "" : cleanEntry.slice(slashIndex);

    const hostMatches =
      tabHost === entryHost || tabHost.endsWith("." + entryHost);

    if (!hostMatches) return false;
    if (!entryPath) return true;

    return parsedTabUrl.pathname.toLowerCase().startsWith(entryPath);
  });
}

async function applyMuteRulesToAllTabs(whitelist) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined || !tab.mutedInfo) continue;

      const excluded = isWhitelisted(tab.url || tab.pendingUrl, whitelist);
      const shouldMute = !excluded;

      if (tab.mutedInfo.muted !== shouldMute) {
        await chrome.tabs.update(tab.id, { muted: shouldMute });
      }
    }
  } catch (err) {
    console.error("Easy Mute Tab error:", err);
  }
}

async function runStartupMute() {
  const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
  await applyMuteRulesToAllTabs(whitelist);
}

// Run when Microsoft Edge starts up
chrome.runtime.onStartup.addListener(() => {
  runStartupMute();
});

// Run when the extension is installed or reloaded
chrome.runtime.onInstalled.addListener(() => {
  runStartupMute();
});

// Update open tabs when whitelist settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.whitelist) {
    applyMuteRulesToAllTabs(changes.whitelist.newValue || []);
  }
});