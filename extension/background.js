// Auto Uploader v1.1.6 - background.js

console.log("[Auto Uploader v1.1.6 Background Service Worker] Initialized.");

let batchState = {
  active: false,
  paused: false,
  items: [],
  pngImages: {}, // filename -> { filename, mimeType, base64Data }
  currentIndex: 0,
  autoSave: true,
  filenameAgnostic: false,
  uploadLoop: true,
  lastUploadedImage: null
};

// Restore state on worker startup
chrome.storage.local.get(['batchItems', 'batchIndex', 'autoSaveWork', 'filenameAgnostic', 'uploadLoop', 'pngImages', 'lastUploadedImage'], (data) => {
  if (data.batchItems) batchState.items = data.batchItems;
  if (data.batchIndex) batchState.currentIndex = data.batchIndex;
  if (data.autoSaveWork !== undefined) batchState.autoSave = data.autoSaveWork;
  if (data.filenameAgnostic !== undefined) batchState.filenameAgnostic = data.filenameAgnostic;
  if (data.uploadLoop !== undefined) batchState.uploadLoop = data.uploadLoop;
  if (data.pngImages) batchState.pngImages = data.pngImages;
  if (data.lastUploadedImage) batchState.lastUploadedImage = data.lastUploadedImage;
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
    batchState.uploadLoop = request.uploadLoop !== undefined ? request.uploadLoop : true;

    chrome.storage.local.set({
      batchItems: batchState.items,
      pngImages: batchState.pngImages,
      batchIndex: batchState.currentIndex,
      autoSaveWork: batchState.autoSave,
      filenameAgnostic: batchState.filenameAgnostic,
      uploadLoop: batchState.uploadLoop
    });

    processNextBatchItem();
    sendResponse({ status: "Upload loop sequence started." });
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

// Process individual item in batch sequence
async function processNextBatchItem() {
  if (!batchState.active || batchState.paused) return;

  if (batchState.currentIndex >= batchState.items.length) {
    batchState.active = false;
    notifyPopupProgress(batchState.currentIndex, "🎉 Batch Complete! All items processed.");
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

  // Save lastUploadedImage into memory & chrome.storage.local
  if (imagePayload) {
    batchState.lastUploadedImage = imagePayload;
    chrome.storage.local.set({ lastUploadedImage: imagePayload });
  }

  notifyPopupProgress(batchState.currentIndex, `Uploading design #${batchState.currentIndex + 1}/${batchState.items.length}: ${currentItem.title}`);

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("[Auto Uploader Background] No active browser tab found.");
    return;
  }

  const uploadUrl = "https://www.redbubble.com/portfolio/images/new";

  function sendFormToTab(targetTabId) {
    chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content.js']
    }, () => {
      setTimeout(() => {
        sendHUDToTab(targetTabId, `Form automation active for item #${batchState.currentIndex + 1}...`);

        chrome.tabs.sendMessage(targetTabId, {
          action: 'APPLY_ALL_FORM',
          item: currentItem,
          imagePayload: imagePayload,
          autoSave: batchState.autoSave
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Auto Uploader Background] Send message error:", chrome.runtime.lastError.message);
          }

          notifyPopupProgress(batchState.currentIndex, response?.status || "Form options applied & submitted.");

          // If autoSave was true, execute the 15-second Upload Loop Sequence
          if (batchState.autoSave) {
            batchState.currentIndex++;
            chrome.storage.local.set({ batchIndex: batchState.currentIndex });

            if (batchState.uploadLoop) {
              let countdown = 15; // Reduced from 25s to 15s per user directive
              
              const timer = setInterval(() => {
                if (!batchState.active || batchState.paused) {
                  clearInterval(timer);
                  return;
                }
                
                notifyPopupProgress(batchState.currentIndex - 1, `⏳ Upload Loop: ${countdown}s remaining...`);
                sendHUDToTab(targetTabId, `⏳ Uploading design... ${countdown}s remaining for publish banner`);

                countdown--;

                if (countdown < 0) {
                  clearInterval(timer);
                  if (!batchState.active || batchState.paused) return;

                  // Step A: Click 'Add another design' link on published page
                  sendHUDToTab(targetTabId, "👉 Clicking 'Add another design' link...");
                  
                  chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    files: ['content.js']
                  }, () => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(targetTabId, { action: 'CLICK_ADD_ANOTHER_DESIGN' }, (addRes) => {
                        notifyPopupProgress(batchState.currentIndex - 1, addRes?.status || "Clicked 'Add another design'");

                        // Wait 3.5s for 'Add new work' choice screen to render
                        setTimeout(() => {
                          if (!batchState.active || batchState.paused) return;

                          // Step B: Click 'Upload new work' card & auto-attach last uploaded image!
                          sendHUDToTab(targetTabId, "👉 Clicking 'Upload new work' & auto-attaching image...");
                          
                          chrome.scripting.executeScript({
                            target: { tabId: targetTabId },
                            files: ['content.js']
                          }, () => {
                            setTimeout(() => {
                              chrome.tabs.sendMessage(targetTabId, {
                                action: 'CLICK_UPLOAD_NEW_WORK',
                                imagePayload: batchState.lastUploadedImage || imagePayload
                              }, (uploadRes) => {
                                notifyPopupProgress(batchState.currentIndex - 1, uploadRes?.status || "Clicked 'Upload new work' & attached image.");

                                // Pause for user to manually input the next JSON and image
                                batchState.active = false;
                                notifyPopupProgress(batchState.currentIndex, "⏸ Placeholder image auto-attached to 'Upload new work'! Select next JSON & image to continue.");
                              });
                            }, 500);
                          });
                        }, 3500);
                      });
                    }, 500);
                  });
                }
              }, 1000);
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
