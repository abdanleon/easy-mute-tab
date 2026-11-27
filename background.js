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

    if (entry.startsWith("http://") || entry.startsWith("https://")) {
      try {
        const parsedEntry = new URL(entry);
        const sameHost =
          tabHost === parsedEntry.hostname.toLowerCase() ||
          tabHost.endsWith("." + parsedEntry.hostname.toLowerCase());

        if (!sameHost) return false;

        if (!parsedEntry.pathname || parsedEntry.pathname === "/") {
          return true;
        }
        return fullUrlLower.startsWith(parsedEntry.href.toLowerCase());
      } catch {
        return fullUrlLower.includes(entry);
      }
    }

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

async function applyMuteRuleToTab(tab, whitelist) {
  if (!tab || tab.id === undefined || !tab.mutedInfo) return;

  const targetUrl = tab.url || tab.pendingUrl || "";
  const excluded = isWhitelisted(targetUrl, whitelist);
  const shouldMute = !excluded;

  if (tab.mutedInfo.muted !== shouldMute) {
    try {
      await chrome.tabs.update(tab.id, { muted: shouldMute });
    } catch {
      // Abaikan jika tab sudah ditutup saat proses update
    }
  }
}

async function applyMuteRulesToAllTabs(whitelistOverride) {
  try {
    const whitelist =
      whitelistOverride !== undefined
        ? whitelistOverride
        : (await chrome.storage.local.get({ whitelist: [] })).whitelist;

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      await applyMuteRuleToTab(tab, whitelist);
    }
  } catch (err) {
    console.error("Mute Tab Easy error:", err);
  }
}

function scheduleStartupSweep() {
  applyMuteRulesToAllTabs();
  setTimeout(() => applyMuteRulesToAllTabs(), 1000);
  setTimeout(() => applyMuteRulesToAllTabs(), 3000);
}

// 1. Jalan saat browser startup
chrome.runtime.onStartup.addListener(() => {
  scheduleStartupSweep();
});

// 2. Jalan saat ekstensi dipasang / di-reload
chrome.runtime.onInstalled.addListener(() => {
  scheduleStartupSweep();
});

// 3. Jalan saat jendela baru dibuka
chrome.windows.onCreated.addListener(() => {
  scheduleStartupSweep();
});

// 4. Jalan setiap kali tab baru dibuat
chrome.tabs.onCreated.addListener(async (tab) => {
  const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
  await applyMuteRuleToTab(tab, whitelist);
});

// 5. Jalan saat URL tab berubah atau selesai loading
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete") {
    const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
    await applyMuteRuleToTab(tab, whitelist);
  }
});

// 6. Jalan saat daftar Excluded Websites diubah dan disimpan
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.whitelist) {
    applyMuteRulesToAllTabs(changes.whitelist.newValue || []);
  }
});
