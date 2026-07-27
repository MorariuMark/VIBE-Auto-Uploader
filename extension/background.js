// Auto Uploader v1.1.1 - background.js

console.log("[Auto Uploader v1.1.1 Background Service Worker] Initialized.");

let batchState = {
  active: false,
  paused: false,
  items: [],
  pngImages: {}, // filename -> { filename, mimeType, base64Data }
  currentIndex: 0,
  autoSave: true,
  filenameAgnostic: false
};

// Restore state on worker startup
chrome.storage.local.get(['batchItems', 'batchIndex', 'autoSaveWork', 'filenameAgnostic', 'pngImages'], (data) => {
  if (data.batchItems) batchState.items = data.batchItems;
  if (data.batchIndex) batchState.currentIndex = data.batchIndex;
  if (data.autoSaveWork !== undefined) batchState.autoSave = data.autoSaveWork;
  if (data.filenameAgnostic !== undefined) batchState.filenameAgnostic = data.filenameAgnostic;
  if (data.pngImages) batchState.pngImages = data.pngImages;
});

// Handle incoming control messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_BATCH') {
    batchState.active = true;
    batchState.paused = false;
    batchState.items = request.items || [];
    batchState.pngImages = request.pngImages || {};
    batchState.currentIndex = request.startIndex || 0;
    batchState.autoSave = request.autoSave !== undefined ? request.autoSave : true;
    batchState.filenameAgnostic = request.filenameAgnostic !== undefined ? request.filenameAgnostic : false;

    chrome.storage.local.set({
      batchItems: batchState.items,
      pngImages: batchState.pngImages,
      batchIndex: batchState.currentIndex,
      autoSaveWork: batchState.autoSave,
      filenameAgnostic: batchState.filenameAgnostic
    });

    processNextBatchItem();
    sendResponse({ status: "Batch sequence started." });
  } else if (request.action === 'PAUSE_BATCH') {
    batchState.paused = true;
    sendResponse({ status: "Batch sequence paused." });
  } else if (request.action === 'STOP_BATCH') {
    batchState.active = false;
    batchState.paused = false;
    sendResponse({ status: "Batch sequence stopped." });
  }
  return true;
});

// Process individual item in batch sequence
async function processNextBatchItem() {
  if (!batchState.active || batchState.paused) return;

  if (batchState.currentIndex >= batchState.items.length) {
    batchState.active = false;
    notifyPopupProgress(batchState.currentIndex, "Batch Complete! All items processed.");
    return;
  }

  const currentItem = batchState.items[batchState.currentIndex];
  let imagePayload = batchState.pngImages[currentItem.image_filename] || null;

  // Filename Agnostic Fallback: pick matching PNG or 1st available PNG
  if (!imagePayload && batchState.filenameAgnostic) {
    const keys = Object.keys(batchState.pngImages);
    if (keys.length > 0) {
      const fallbackKey = keys[batchState.currentIndex % keys.length];
      imagePayload = batchState.pngImages[fallbackKey];
    }
  }

  notifyPopupProgress(batchState.currentIndex, `Processing item #${batchState.currentIndex + 1}: ${currentItem.title}`);

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("[Auto Uploader Background] No active tab found.");
    return;
  }

  const uploadUrl = "https://www.redbubble.com/portfolio/images/new";

  function sendFormToTab(targetTabId) {
    // Inject content script to ensure listener is active
    chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content.js']
    }, () => {
      setTimeout(() => {
        chrome.tabs.sendMessage(targetTabId, {
          action: 'APPLY_ALL_FORM',
          item: currentItem,
          imagePayload: imagePayload,
          autoSave: batchState.autoSave
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Auto Uploader Background] Send message error:", chrome.runtime.lastError.message);
          }

          notifyPopupProgress(batchState.currentIndex, response?.status || "Form options applied.");

          // If autoSave was true, wait for submission, then advance batch index and process next item
          if (batchState.autoSave) {
            batchState.currentIndex++;
            chrome.storage.local.set({ batchIndex: batchState.currentIndex });
            setTimeout(() => {
              processNextBatchItem();
            }, 3500);
          }
        });
      }, 500);
    });
  }

  // Navigate tab if not on upload page
  if (!tab.url || !tab.url.includes("/portfolio/images/new")) {
    chrome.tabs.update(tab.id, { url: uploadUrl }, () => {
      function pageLoadListener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(pageLoadListener);
          setTimeout(() => {
            if (!batchState.active || batchState.paused) return;
            sendFormToTab(tab.id);
          }, 1500);
        }
      }
      chrome.tabs.onUpdated.addListener(pageLoadListener);
    });
  } else {
    sendFormToTab(tab.id);
  }
}

function notifyPopupProgress(index, status) {
  chrome.runtime.sendMessage({
    action: 'BATCH_PROGRESS',
    index,
    status
  }).catch(() => {
    // Ignore error if popup is closed
  });
}
