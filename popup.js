const textarea = document.getElementById("whitelistInput");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

function parseLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Load saved whitelist when the popup opens
document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get({ whitelist: [] });
  textarea.value = data.whitelist.join("\n");
});

// Save settings when the Save button is clicked
saveBtn.addEventListener("click", async () => {
  const list = parseLines(textarea.value);
  await chrome.storage.local.set({ whitelist: list });
  textarea.value = list.join("\n");
  statusEl.textContent = "Settings saved and active.";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2500);
});