// Auto Uploader v1.3.0 - background.js

console.log("[Auto Uploader v1.3.0 Background Service Worker] Initialized.");

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
  platform: 'redbubble',
  items: [],
  currentIndex: 0,
  autoSave: true,
  filenameAgnostic: false,
  uploadLoop: true,
  humanizedDelay: true,
  maxBatchLimit: 3,
  sessionCount: 0
};

// Restore state on worker startup
chrome.storage.local.get(['batchItems', 'batchIndex', 'autoSaveWork', 'filenameAgnostic', 'uploadLoop', 'humanizedDelay', 'activePlatform', 'maxBatchLimit'], (data) => {
  if (data.batchItems) batchState.items = data.batchItems;
  if (data.batchIndex) batchState.currentIndex = data.batchIndex;
  if (data.autoSaveWork !== undefined) batchState.autoSave = data.autoSaveWork;
  if (data.filenameAgnostic !== undefined) batchState.filenameAgnostic = data.filenameAgnostic;
  if (data.uploadLoop !== undefined) batchState.uploadLoop = data.uploadLoop;
  if (data.humanizedDelay !== undefined) batchState.humanizedDelay = data.humanizedDelay;
  if (data.activePlatform) batchState.platform = data.activePlatform;
  if (data.maxBatchLimit !== undefined) batchState.maxBatchLimit = data.maxBatchLimit;
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
    batchState.platform = request.platform || 'redbubble';
    batchState.items = request.items || batchState.items || [];
    batchState.currentIndex = request.startIndex !== undefined ? request.startIndex : batchState.currentIndex;
    batchState.autoSave = request.autoSave !== undefined ? request.autoSave : true;
    batchState.filenameAgnostic = request.filenameAgnostic !== undefined ? request.filenameAgnostic : false;
    batchState.uploadLoop = request.uploadLoop !== undefined ? request.uploadLoop : true;
    batchState.maxBatchLimit = request.maxBatchLimit !== undefined ? Number(request.maxBatchLimit) : 3;
    batchState.sessionCount = 0;

    chrome.storage.local.set({
      batchItems: batchState.items,
      batchIndex: batchState.currentIndex,
      autoSaveWork: batchState.autoSave,
      filenameAgnostic: batchState.filenameAgnostic,
      uploadLoop: batchState.uploadLoop,
      humanizedDelay: batchState.humanizedDelay,
      activePlatform: batchState.platform,
      maxBatchLimit: batchState.maxBatchLimit
    });

    processNextBatchItem();
    sendResponse({ status: `Automated ${batchState.platform} batch sequence started.` });
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
    batchState.platform = request.platform || batchState.platform || 'redbubble';
    batchState.items = request.items || batchState.items || [];
    chrome.storage.local.set({ batchIndex: 0 });
    notifyPopupProgress(0, `🔄 Restarting ${batchState.platform} batch upload sequence from item #1...`);
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

  const isTeePublic = batchState.platform === 'teepublic';
  const uploadUrl = isTeePublic ? "https://www.teepublic.com/design/new" : "https://www.redbubble.com/portfolio/images/new";

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

    sendHUDToTab(targetTabId, `⚡ Applying ${isTeePublic ? 'TeePublic' : 'Redbubble'} form for item #${batchState.currentIndex + 1}...`);

    chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content.js']
    }, () => {
      setTimeout(() => {
        const actionType = isTeePublic ? 'TP_APPLY_ALL_FORM' : 'APPLY_ALL_FORM';
        chrome.tabs.sendMessage(targetTabId, {
          action: actionType,
          item: currentItem,
          imagePayload: imagePayload,
          autoSave: batchState.autoSave
        }, async (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Auto Uploader Background] Send message error:", chrome.runtime.lastError.message);
          }

          notifyPopupProgress(batchState.currentIndex, response?.status || "Form options applied & submitted.");

            batchState.sessionCount = (batchState.sessionCount || 0) + 1;

            // Check Batch Safety Cap limit
            if (batchState.maxBatchLimit > 0 && batchState.sessionCount >= batchState.maxBatchLimit) {
              batchState.active = false;
              const capMsg = `🛡️ Safety Cap Reached! Batch automatically paused after ${batchState.sessionCount} items for account protection.`;
              notifyPopupProgress(batchState.currentIndex + 1, capMsg);
              sendHUDToTab(targetTabId, capMsg);
              return;
            }

            if (nextIndex >= batchState.items.length) {
              batchState.active = false;
              notifyPopupProgress(nextIndex, "🎉 Batch Complete! All items in folder uploaded.");
              sendHUDToTab(targetTabId, "🎉 Batch Complete! All items uploaded.");
              return;
            }

            if (batchState.uploadLoop) {
              if (isTeePublic) {
                // ---- TeePublic Stealth Upload Loop ----
                // Step 1: Random 30 to 60 second post-publish delay (stealth requirement)
                const postPublishSec = Math.floor(Math.random() * (60 - 30 + 1)) + 30;
                let countdown = postPublishSec;
                while (countdown > 0) {
                  if (!batchState.active || batchState.paused) return;
                  notifyPopupProgress(batchState.currentIndex, `⏳ Stealth pause: ${countdown}s remaining post-publish...`);
                  sendHUDToTab(targetTabId, `⏳ Design published! Stealth cooldown: ${countdown}s remaining...`);
                  const ok = await interruptibleSleep(1000);
                  if (!ok || !batchState.active || batchState.paused) return;
                  countdown--;
                }

                if (!batchState.active || batchState.paused) return;

                // Micro-pause before clicking 'Upload Art'
                if (batchState.humanizedDelay) {
                  const delayMs = getRandomDelay(2, 6);
                  const delaySec = (delayMs / 1000).toFixed(1);
                  sendHUDToTab(targetTabId, `⏳ Humanizing pause: waiting ${delaySec}s before clicking 'Upload Art'...`);
                  const ok = await interruptibleSleep(delayMs);
                  if (!ok || !batchState.active || batchState.paused) return;
                }

                // Step 2: Click 'Upload Art' button
                sendHUDToTab(targetTabId, "👉 Clicking 'Upload Art' button...");
                chrome.tabs.sendMessage(targetTabId, { action: 'TP_CLICK_UPLOAD_ART' }, async (artRes) => {
                  notifyPopupProgress(batchState.currentIndex, artRes?.status || "Clicked 'Upload Art'");

                  // Step 3: Wait 5-9 seconds for upload page to load
                  const uploadPageDelay = getRandomDelay(5, 9);
                  const okUploadPage = await interruptibleSleep(uploadPageDelay);
                  if (!okUploadPage || !batchState.active || batchState.paused) return;

                  // Fetch current image payload for NEXT item
                  const nextItem = batchState.items[nextIndex];
                  let nextImagePayload = await ImageDB.getImagePayload(nextItem.image_filename);
                  if (!nextImagePayload && batchState.filenameAgnostic) {
                    nextImagePayload = await ImageDB.getFirstAvailableImagePayload();
                  }

                  // Step 4: Click file upload & attach next image
                  sendHUDToTab(targetTabId, `🖼️ Uploading image for item #${nextIndex + 1}...`);
                  chrome.tabs.sendMessage(targetTabId, {
                    action: 'TP_CLICK_UPLOAD_FILE',
                    imagePayload: nextImagePayload
                  }, async (fileRes) => {
                    notifyPopupProgress(batchState.currentIndex, fileRes?.status || "File upload triggered.");

                    // Advance index to next item
                    batchState.currentIndex = nextIndex;
                    chrome.storage.local.set({ batchIndex: batchState.currentIndex });

                    // Stealth pause (4-8s) before starting next form fill
                    const nextStepDelay = getRandomDelay(4, 8);
                    const okNext = await interruptibleSleep(nextStepDelay);
                    if (!okNext || !batchState.active || batchState.paused) return;

                    processNextBatchItem();
                  });
                });
               } else {
                // ---- Redbubble Stealth Upload Loop ----
                // Step 1: Random 45 to 90 second post-publish delay (stealth requirement)
                const postPublishSec = Math.floor(Math.random() * (90 - 45 + 1)) + 45;
                let countdown = postPublishSec;
                while (countdown > 0) {
                  if (!batchState.active || batchState.paused) return;
                  notifyPopupProgress(batchState.currentIndex, `⏳ Redbubble stealth pause: ${countdown}s remaining post-publish...`);
                  sendHUDToTab(targetTabId, `⏳ Design published! Stealth cooldown: ${countdown}s remaining...`);
                  const ok = await interruptibleSleep(1000);
                  if (!ok || !batchState.active || batchState.paused) return;
                  countdown--;
                }

                if (!batchState.active || batchState.paused) return;

                if (batchState.humanizedDelay) {
                  const delayMs = getRandomDelay(2, 7);
                  const delaySec = (delayMs / 1000).toFixed(1);
                  sendHUDToTab(targetTabId, `⏳ Humanizing pause: waiting ${delaySec}s before 'Add another design'...`);
                  const ok = await interruptibleSleep(delayMs);
                  if (!ok || !batchState.active || batchState.paused) return;
                }

                sendHUDToTab(targetTabId, "👉 Clicking 'Add another design' link...");
                chrome.tabs.sendMessage(targetTabId, { action: 'CLICK_ADD_ANOTHER_DESIGN' }, async (addRes) => {
                  notifyPopupProgress(batchState.currentIndex, addRes?.status || "Clicked 'Add another design'");

                  const okChoice = await interruptibleSleep(getRandomDelay(4, 8));
                  if (!okChoice || !batchState.active || batchState.paused) return;

                  const nextItem = batchState.items[nextIndex];
                  let nextImagePayload = await ImageDB.getImagePayload(nextItem.image_filename);
                  if (!nextImagePayload && batchState.filenameAgnostic) {
                    nextImagePayload = await ImageDB.getFirstAvailableImagePayload();
                  }

                  if (batchState.humanizedDelay) {
                    const delayMs = getRandomDelay(2, 6);
                    const delaySec = (delayMs / 1000).toFixed(1);
                    sendHUDToTab(targetTabId, `⏳ Humanizing pause: waiting ${delaySec}s before 'Upload new work'...`);
                    const ok = await interruptibleSleep(delayMs);
                    if (!ok || !batchState.active || batchState.paused) return;
                  }

                  sendHUDToTab(targetTabId, `👉 Clicking 'Upload new work' & attaching image for item #${nextIndex + 1}...`);

                  chrome.tabs.sendMessage(targetTabId, {
                    action: 'CLICK_UPLOAD_NEW_WORK',
                    imagePayload: nextImagePayload
                  }, async (uploadRes) => {
                    notifyPopupProgress(batchState.currentIndex, uploadRes?.status || "Clicked 'Upload new work' & attached next image.");

                    // Advance index to next item
                    batchState.currentIndex = nextIndex;
                    chrome.storage.local.set({ batchIndex: batchState.currentIndex });

                    // Stealth pause (4-8s) before starting next form fill
                    const nextStepDelay = getRandomDelay(4, 8);
                    const okNext = await interruptibleSleep(nextStepDelay);
                    if (!okNext || !batchState.active || batchState.paused) return;

                    processNextBatchItem();
                  });
                });
              }
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

  // Navigate tab if not on relevant upload page
  const isOnUploadPage = isTeePublic 
    ? (tab.url && tab.url.includes("teepublic.com"))
    : (tab.url && tab.url.includes("/portfolio/images/new"));

  if (!isOnUploadPage) {
    const fallbackUrl = isTeePublic ? "https://www.teepublic.com/uploader" : "https://www.redbubble.com/portfolio/images/new";
    chrome.tabs.update(tab.id, { url: fallbackUrl }, () => {
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

