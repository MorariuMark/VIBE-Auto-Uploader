// Auto Uploader v1.1.7 - background.js

console.log("[Auto Uploader v1.1.7 Background Service Worker] Initialized.");

// IndexedDB image store for handling hundreds of image files on-demand without memory limits
const ImageDB = {
  dbName: 'AutoUploaderImageStore',
  storeName: 'imageBlobs',
  getDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async getRawBlob(filename) {
    if (!filename) return null;
    const db = await this.getDB();
    const targetLower = filename.toLowerCase();
    const targetStem = targetLower.replace(/\.[^/.]+$/, "");

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);

      const directReq = store.get(targetLower);
      directReq.onsuccess = () => {
        if (directReq.result) return resolve({ filename: filename, blob: directReq.result });

        const openReq = store.openCursor();
        openReq.onsuccess = (evt) => {
          const cursor = evt.target.result;
          if (!cursor) return resolve(null);

          const key = cursor.key.toString();
          const keyStem = key.replace(/\.[^/.]+$/, "");
          if (key === targetLower || keyStem === targetStem) {
            return resolve({ filename: cursor.key, blob: cursor.value });
          }
          cursor.continue();
        };
        openReq.onerror = () => resolve(null);
      };
      directReq.onerror = () => resolve(null);
    });
  },
  async getImagePayload(filename) {
    const result = await this.getRawBlob(filename);
    if (!result || !result.blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          filename: result.filename,
          mimeType: result.blob.type || (result.filename.endsWith('.png') ? 'image/png' : 'image/jpeg'),
          base64Data: e.target.result
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(result.blob);
    });
  },
  async getFirstAvailableImagePayload() {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).openCursor();
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (!cursor) return resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            filename: cursor.key,
            mimeType: cursor.value.type || 'image/png',
            base64Data: e.target.result
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(cursor.value);
      };
      req.onerror = () => resolve(null);
    });
  }
};

let batchState = {
  active: false,
  paused: false,
  items: [],
  currentIndex: 0,
  autoSave: true,
  filenameAgnostic: false,
  uploadLoop: true,
  humanizedDelay: true
};

// Restore state on worker startup
chrome.storage.local.get(['batchItems', 'batchIndex', 'autoSaveWork', 'filenameAgnostic', 'uploadLoop', 'humanizedDelay'], (data) => {
  if (data.batchItems) batchState.items = data.batchItems;
  if (data.batchIndex) batchState.currentIndex = data.batchIndex;
  if (data.autoSaveWork !== undefined) batchState.autoSave = data.autoSaveWork;
  if (data.filenameAgnostic !== undefined) batchState.filenameAgnostic = data.filenameAgnostic;
  if (data.uploadLoop !== undefined) batchState.uploadLoop = data.uploadLoop;
  if (data.humanizedDelay !== undefined) batchState.humanizedDelay = data.humanizedDelay;
});

// Helper for random 1-8s humanization delay
function getRandomDelay(minSec = 1, maxSec = 8) {
  return Math.floor(Math.random() * (maxSec - minSec + 1) * 1000) + (minSec * 1000);
}

// Sleep helper with instant cancellation check
function interruptibleSleep(ms) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!batchState.active || batchState.paused) {
        clearInterval(interval);
        resolve(false); // Interrupted!
      } else if (Date.now() - start >= ms) {
        clearInterval(interval);
        resolve(true); // Completed cleanly
      }
    }, 150);
  });
}

// Handle incoming control messages (Start, Pause, Stop, Restart)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_BATCH') {
    batchState.active = true;
    batchState.paused = false;
    batchState.items = request.items || batchState.items || [];
    batchState.currentIndex = request.startIndex !== undefined ? request.startIndex : batchState.currentIndex;
    batchState.autoSave = request.autoSave !== undefined ? request.autoSave : true;
    batchState.filenameAgnostic = request.filenameAgnostic !== undefined ? request.filenameAgnostic : false;
    batchState.uploadLoop = request.uploadLoop !== undefined ? request.uploadLoop : true;
    batchState.humanizedDelay = request.humanizedDelay !== undefined ? request.humanizedDelay : true;

    chrome.storage.local.set({
      batchItems: batchState.items,
      batchIndex: batchState.currentIndex,
      autoSaveWork: batchState.autoSave,
      filenameAgnostic: batchState.filenameAgnostic,
      uploadLoop: batchState.uploadLoop,
      humanizedDelay: batchState.humanizedDelay
    });

    processNextBatchItem();
    sendResponse({ status: "Automated batch sequence started." });
  } else if (request.action === 'PAUSE_BATCH') {
    batchState.paused = true;
    notifyPopupProgress(batchState.currentIndex, "⏸ Batch sequence paused.");
    sendResponse({ status: "Batch sequence paused." });
  } else if (request.action === 'STOP_BATCH') {
    batchState.active = false;
    batchState.paused = false;
    notifyPopupProgress(batchState.currentIndex, "⏹ Batch sequence stopped instantly.");
    sendResponse({ status: "Batch sequence stopped." });
  } else if (request.action === 'RESTART_BATCH') {
    batchState.currentIndex = 0;
    batchState.active = true;
    batchState.paused = false;
    batchState.items = request.items || batchState.items || [];
    chrome.storage.local.set({ batchIndex: 0 });
    notifyPopupProgress(0, "🔄 Restarting batch upload sequence from item #1...");
    processNextBatchItem();
    sendResponse({ status: "Batch sequence restarted." });
  }
  return true;
});

// Send HUD Message to active Tab safely
function sendHUDToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, { action: 'SHOW_HUD', message }).catch(() => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }, () => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'SHOW_HUD', message }).catch(() => {});
      }, 300);
    });
  });
}

// Process individual item in batch sequence automatically
async function processNextBatchItem() {
  if (!batchState.active || batchState.paused) return;

  if (batchState.currentIndex >= batchState.items.length) {
    batchState.active = false;
    notifyPopupProgress(batchState.currentIndex, "🎉 Batch Complete! All items in folder uploaded.");
    return;
  }

  const currentItem = batchState.items[batchState.currentIndex];

  // Fetch image payload on demand from IndexedDB
  let imagePayload = await ImageDB.getImagePayload(currentItem.image_filename);
  if (!imagePayload && batchState.filenameAgnostic) {
    imagePayload = await ImageDB.getFirstAvailableImagePayload();
  }

  notifyPopupProgress(batchState.currentIndex, `[Item ${batchState.currentIndex + 1}/${batchState.items.length}] Preparing "${currentItem.title}"...`);

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("[Auto Uploader Background] No active browser tab found.");
    batchState.active = false;
    return;
  }

  const uploadUrl = "https://www.redbubble.com/portfolio/images/new";

  async function sendFormToTab(targetTabId) {
    if (!batchState.active || batchState.paused) return;

    // Random humanized delay before filling form
    if (batchState.humanizedDelay) {
      const delayMs = getRandomDelay(1, 8);
      const delaySec = (delayMs / 1000).toFixed(1);
      sendHUDToTab(targetTabId, `⏳ Anti-bot pause: waiting ${delaySec}s before filling form...`);
      notifyPopupProgress(batchState.currentIndex, `⏳ Anti-bot pause: waiting ${delaySec}s...`);
      const ok = await interruptibleSleep(delayMs);
      if (!ok || !batchState.active || batchState.paused) return;
    }

    sendHUDToTab(targetTabId, `⚡ Applying form for item #${batchState.currentIndex + 1}...`);

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
        }, async (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Auto Uploader Background] Send message error:", chrome.runtime.lastError.message);
          }

          notifyPopupProgress(batchState.currentIndex, response?.status || "Form options applied & submitted.");

          // If autoSave was true, proceed to Upload Loop for next item
          if (batchState.autoSave) {
            const nextIndex = batchState.currentIndex + 1;

            if (nextIndex >= batchState.items.length) {
              batchState.active = false;
              notifyPopupProgress(nextIndex, "🎉 Batch Complete! All items in folder uploaded.");
              sendHUDToTab(targetTabId, "🎉 Batch Complete! All items uploaded.");
              return;
            }

            if (batchState.uploadLoop) {
              let countdown = 12; // Wait 12 seconds for Redbubble to publish page
              
              while (countdown > 0) {
                if (!batchState.active || batchState.paused) return;
                notifyPopupProgress(batchState.currentIndex, `⏳ Waiting ${countdown}s for Redbubble publish banner...`);
                sendHUDToTab(targetTabId, `⏳ Design published! Waiting ${countdown}s for success banner...`);
                const ok = await interruptibleSleep(1000);
                if (!ok || !batchState.active || batchState.paused) return;
                countdown--;
              }

              if (!batchState.active || batchState.paused) return;

              // Random delay before clicking 'Add another design'
              if (batchState.humanizedDelay) {
                const delayMs = getRandomDelay(1, 6);
                const delaySec = (delayMs / 1000).toFixed(1);
                sendHUDToTab(targetTabId, `⏳ Anti-bot pause: waiting ${delaySec}s before 'Add another design'...`);
                const ok = await interruptibleSleep(delayMs);
                if (!ok || !batchState.active || batchState.paused) return;
              }

              // Step A: Click 'Add another design'
              sendHUDToTab(targetTabId, "👉 Clicking 'Add another design' link...");
              chrome.tabs.sendMessage(targetTabId, { action: 'CLICK_ADD_ANOTHER_DESIGN' }, async (addRes) => {
                notifyPopupProgress(batchState.currentIndex, addRes?.status || "Clicked 'Add another design'");

                // Wait 3 seconds for design choice screen to load
                const okChoice = await interruptibleSleep(3000);
                if (!okChoice || !batchState.active || batchState.paused) return;

                // Step B: Fetch CURRENT image payload for NEXT item (#nextIndex)
                const nextItem = batchState.items[nextIndex];
                let nextImagePayload = await ImageDB.getImagePayload(nextItem.image_filename);
                if (!nextImagePayload && batchState.filenameAgnostic) {
                  nextImagePayload = await ImageDB.getFirstAvailableImagePayload();
                }

                // Random delay before clicking 'Upload new work' card
                if (batchState.humanizedDelay) {
                  const delayMs = getRandomDelay(1, 6);
                  const delaySec = (delayMs / 1000).toFixed(1);
                  sendHUDToTab(targetTabId, `⏳ Anti-bot pause: waiting ${delaySec}s before 'Upload new work'...`);
                  const ok = await interruptibleSleep(delayMs);
                  if (!ok || !batchState.active || batchState.paused) return;
                }

                // Click 'Upload new work' card passing CURRENT image payload for NEXT item!
                sendHUDToTab(targetTabId, `👉 Clicking 'Upload new work' & attaching image for item #${nextIndex + 1}...`);

                chrome.tabs.sendMessage(targetTabId, {
                  action: 'CLICK_UPLOAD_NEW_WORK',
                  imagePayload: nextImagePayload
                }, async (uploadRes) => {
                  notifyPopupProgress(batchState.currentIndex, uploadRes?.status || "Clicked 'Upload new work' & attached next image.");

                  // Advance index to next item automatically!
                  batchState.currentIndex = nextIndex;
                  chrome.storage.local.set({ batchIndex: batchState.currentIndex });

                  // Wait 3 seconds then process next item in cycle automatically!
                  const okNext = await interruptibleSleep(3000);
                  if (!okNext || !batchState.active || batchState.paused) return;

                  processNextBatchItem();
                });
              });
            } else {
              // Direct URL refresh fallback
              setTimeout(() => {
                if (!batchState.active || batchState.paused) return;
                chrome.tabs.update(targetTabId, { url: uploadUrl }, (updatedTab) => {
                  function pageLoadListener(tabId, changeInfo) {
                    if (tabId === targetTabId && changeInfo.status === 'complete') {
                      chrome.tabs.onUpdated.removeListener(pageLoadListener);
                      setTimeout(() => {
                        processNextBatchItem();
                      }, 1800);
                    }
                  }
                  chrome.tabs.onUpdated.addListener(pageLoadListener);
                });
              }, 4500);
            }
          }
        });
      }, 600);
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
          }, 1800);
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

