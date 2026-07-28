// Auto Uploader v1.1.7 - popup.js

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
  async saveImage(filename, fileOrBlob) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(fileOrBlob, filename.toLowerCase());
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
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
  },
  async clear() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
};

let parsedDataset = [];
let loadedPngMap = new Map(); // filename -> File object
let storedPngDataMap = {};   // filename -> { filename, mimeType, base64Data }
let currentIndex = 0;

// DOM Elements
const folderFileInput = document.getElementById('folderFileInput');
const folderFileLabel = document.getElementById('folderFileLabel');
const jsonFileInput = document.getElementById('jsonFileInput');
const jsonFileLabel = document.getElementById('jsonFileLabel');
const jsonPasteInput = document.getElementById('jsonPasteInput');
const parseJsonTextBtn = document.getElementById('parseJsonTextBtn');

const csvFileInput = document.getElementById('csvFileInput');
const csvFileLabel = document.getElementById('csvFileLabel');
const pngFilesInput = document.getElementById('pngFilesInput');
const pngFilesLabel = document.getElementById('pngFilesLabel');
const fieldPreview = document.getElementById('fieldPreview');
const itemCounter = document.getElementById('itemCounter');
const prevItemBtn = document.getElementById('prevItemBtn');
const nextItemBtn = document.getElementById('nextItemBtn');
const autoSaveToggle = document.getElementById('autoSaveToggle');
const autoStartFolderToggle = document.getElementById('autoStartFolderToggle');
const filenameAgnosticToggle = document.getElementById('filenameAgnosticToggle');
const uploadLoopToggle = document.getElementById('uploadLoopToggle');
const humanizedDelayToggle = document.getElementById('humanizedDelayToggle');
const progressBarFill = document.getElementById('progressBarFill');
const logBox = document.getElementById('logBox');

// Action buttons
const triggerEnableProducts = document.getElementById('triggerEnableProducts');
const triggerTickMedia = document.getElementById('triggerTickMedia');
const triggerDefaultOptimized = document.getElementById('triggerDefaultOptimized');
const triggerPublicVisibility = document.getElementById('triggerPublicVisibility');
const triggerMatureNo = document.getElementById('triggerMatureNo');
const triggerUserAgreement = document.getElementById('triggerUserAgreement');
const triggerApplyAllForm = document.getElementById('triggerApplyAllForm');

// Batch controls
const startBatchBtn = document.getElementById('startBatchBtn');
const pauseBatchBtn = document.getElementById('pauseBatchBtn');
const stopBatchBtn = document.getElementById('stopBatchBtn');
const restartBatchBtn = document.getElementById('restartBatchBtn');

// Helper: Log message to UI
function logMsg(msg) {
  const timestamp = new Date().toLocaleTimeString();
  logBox.textContent = `[${timestamp}] ${msg}\n` + logBox.textContent;
}

// Restore saved settings on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['autoSaveWork', 'autoStartFolder', 'filenameAgnostic', 'uploadLoop', 'humanizedDelay', 'batchItems', 'batchIndex'], (data) => {
    if (data.autoSaveWork !== undefined) {
      autoSaveToggle.checked = data.autoSaveWork;
    }
    if (data.autoStartFolder !== undefined && autoStartFolderToggle) {
      autoStartFolderToggle.checked = data.autoStartFolder;
    }
    if (data.filenameAgnostic !== undefined) {
      filenameAgnosticToggle.checked = data.filenameAgnostic;
    }
    if (data.uploadLoop !== undefined) {
      uploadLoopToggle.checked = data.uploadLoop;
    }
    if (data.humanizedDelay !== undefined && humanizedDelayToggle) {
      humanizedDelayToggle.checked = data.humanizedDelay;
    }
    if (data.batchItems && data.batchItems.length > 0) {
      parsedDataset = data.batchItems;
      currentIndex = data.batchIndex || 0;
      updateInspector();
      logMsg(`Restored batch of ${parsedDataset.length} items from storage.`);
    }
  });
});

autoSaveToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoSaveWork: autoSaveToggle.checked });
  logMsg(`Auto Save Work set to: ${autoSaveToggle.checked}`);
});

autoStartFolderToggle?.addEventListener('change', () => {
  chrome.storage.local.set({ autoStartFolder: autoStartFolderToggle.checked });
  logMsg(`Auto-Start Upload on Folder Select set to: ${autoStartFolderToggle.checked}`);
});

filenameAgnosticToggle.addEventListener('change', () => {
  chrome.storage.local.set({ filenameAgnostic: filenameAgnosticToggle.checked });
  logMsg(`Filename Agnostic Mode set to: ${filenameAgnosticToggle.checked}`);
  updateInspector();
});

uploadLoopToggle?.addEventListener('change', () => {
  chrome.storage.local.set({ uploadLoop: uploadLoopToggle.checked });
  logMsg(`Upload loop set to: ${uploadLoopToggle.checked}`);
});

humanizedDelayToggle?.addEventListener('change', () => {
  chrome.storage.local.set({ humanizedDelay: humanizedDelayToggle.checked });
  logMsg(`Humanized Pauses set to: ${humanizedDelayToggle.checked}`);
});

// JSON Parser Helper (Default Data Source)
function parseJSONText(text) {
  let jsonArray = [];
  try {
    const raw = JSON.parse(text);
    jsonArray = Array.isArray(raw) ? raw : [raw];
  } catch (err) {
    logMsg(`JSON Parse Error: ${err.message}`);
    return [];
  }

  return jsonArray.map((item) => {
    const image_filename = item.image_filename || item.image || item.filename || item.file || '';
    const title = item.title || item.design_title || item.name || '';
    const main_tag = item.main_tag || item.primary_tag || item.main_keyword || '';

    let supporting_tags = item.supporting_tags || item.secondary_tags || '';
    if (Array.isArray(supporting_tags)) {
      supporting_tags = supporting_tags.join(', ');
    }

    let tags = item.tags || item.keywords || '';
    if (Array.isArray(tags)) {
      tags = tags.join(', ');
    }

    if (!supporting_tags && tags) {
      supporting_tags = tags;
    }

    const description = item.description || item.desc || item.product_description || '';
    const background_color = item.background_color || item.hex || item.bg_color || item.color || '';

    return {
      image_filename,
      title,
      main_tag,
      supporting_tags,
      description,
      background_color
    };
  });
}

// Handle Output Folder Selection (Auto-Match JSONs & Images with IndexedDB Storage)
folderFileInput?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Selected Folder';
  folderFileLabel.textContent = `📁 ${folderName}`;
  logMsg(`Scanning folder "${folderName}" (${files.length} total files)...`);

  const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
  const imageFiles = files.filter(f => {
    const ext = f.name.toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp');
  });

  if (jsonFiles.length === 0) {
    logMsg(`⚠️ No JSON files found in selected folder.`);
    return;
  }

  // 1. Store all image files into IndexedDB on-demand (No RAM limit!)
  logMsg(`Indexing ${imageFiles.length} image files into IndexedDB...`);
  await ImageDB.clear();

  const storePromises = imageFiles.map(file => ImageDB.saveImage(file.name, file));
  await Promise.all(storePromises);

  pngFilesLabel.textContent = `🖼️ ${imageFiles.length} Images Indexed`;
  logMsg(`Indexed ${imageFiles.length} images safely with zero RAM overhead.`);

  // 2. Read and parse all JSON files
  let aggregatedDataset = [];

  const readJsonPromises = jsonFiles.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const items = parseJSONText(evt.target.result);
        const fileStem = file.name.replace(/\.[^/.]+$/, "").toLowerCase();

        items.forEach(item => {
          if (!item.image_filename) {
            const matchingImg = imageFiles.find(img => img.name.replace(/\.[^/.]+$/, "").toLowerCase() === fileStem);
            if (matchingImg) {
              item.image_filename = matchingImg.name;
            }
          }
        });

        aggregatedDataset.push(...items);
        resolve();
      };
      reader.onerror = () => resolve();
      reader.readAsText(file);
    });
  });

  await Promise.all(readJsonPromises);

  if (aggregatedDataset.length > 0) {
    parsedDataset = aggregatedDataset;
    currentIndex = 0;
    chrome.storage.local.set({ batchItems: parsedDataset, batchIndex: 0 });
    updateInspector();
    logMsg(`✅ Auto-matched folder "${folderName}": ${parsedDataset.length} JSON item(s) & ${imageFiles.length} image(s).`);

    if (autoStartFolderToggle && autoStartFolderToggle.checked) {
      logMsg(`⚡ Auto-Start active! Starting automated upload sequence...`);
      setTimeout(() => {
        startBatchBtn.click();
      }, 600);
    }
  } else {
    logMsg(`⚠️ No valid metadata could be extracted from JSON files.`);
  }
});

// Handle Single JSON File Selection
jsonFileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  jsonFileLabel.textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = (evt) => {
    parsedDataset = parseJSONText(evt.target.result);
    currentIndex = 0;
    chrome.storage.local.set({ batchItems: parsedDataset, batchIndex: 0 });
    updateInspector();
    logMsg(`Loaded JSON batch of ${parsedDataset.length} items from file.`);
  };
  reader.readAsText(file);
});

// Handle JSON Paste Text Button
parseJsonTextBtn?.addEventListener('click', () => {
  const text = jsonPasteInput.value.trim();
  if (!text) {
    logMsg('Please paste JSON array text into the box.');
    return;
  }
  parsedDataset = parseJSONText(text);
  currentIndex = 0;
  chrome.storage.local.set({ batchItems: parsedDataset, batchIndex: 0 });
  updateInspector();
  logMsg(`Loaded JSON batch of ${parsedDataset.length} items from pasted text.`);
});

// Handle PNG/JPG Files Selection directly
pngFilesInput?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  await ImageDB.clear();
  const storePromises = files.map(file => ImageDB.saveImage(file.name, file));
  await Promise.all(storePromises);

  pngFilesLabel.textContent = `🖼️ ${files.length} Images Loaded`;
  logMsg(`Loaded and stored ${files.length} design images into IndexedDB.`);
  updateInspector();
});

// Navigation Controls
prevItemBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    chrome.storage.local.set({ batchIndex: currentIndex });
    updateInspector();
  }
});

nextItemBtn.addEventListener('click', () => {
  if (currentIndex < parsedDataset.length - 1) {
    currentIndex++;
    chrome.storage.local.set({ batchIndex: currentIndex });
    updateInspector();
  }
});

// Update Inspector UI
function updateInspector() {
  if (parsedDataset.length === 0) {
    itemCounter.textContent = '0 / 0';
    fieldPreview.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px;">Load Folder, JSON, or CSV to inspect metadata fields.</div>`;
    return;
  }

  itemCounter.textContent = `${currentIndex + 1} / ${parsedDataset.length}`;
  const currentItem = parsedDataset[currentIndex];

  fieldPreview.innerHTML = `
    <div class="field-row">
      <span class="field-key">Image</span>
      <span class="field-val" title="${currentItem.image_filename}">
        ${currentItem.image_filename || 'any_image.png'} ✅
      </span>
      <button class="btn btn-secondary btn-xs" id="applyImageBtn">Attach</button>
    </div>
    <div class="field-row">
      <span class="field-key">Title</span>
      <span class="field-val" title="${currentItem.title}">${currentItem.title || '<span style="color:#64748b;font-style:italic;">(empty)</span>'}</span>
      <button class="btn btn-secondary btn-xs" id="applyTitleBtn" ${currentItem.title ? '' : 'disabled'}>Apply</button>
    </div>
    <div class="field-row">
      <span class="field-key">Main Tag</span>
      <span class="field-val" title="${currentItem.main_tag}">${currentItem.main_tag || '<span style="color:#64748b;font-style:italic;">(empty)</span>'}</span>
      <button class="btn btn-secondary btn-xs" id="applyMainTagBtn" ${currentItem.main_tag ? '' : 'disabled'}>Apply</button>
    </div>
    <div class="field-row">
      <span class="field-key">Supporting</span>
      <span class="field-val" title="${currentItem.supporting_tags}">${currentItem.supporting_tags || '<span style="color:#64748b;font-style:italic;">(empty)</span>'}</span>
      <button class="btn btn-secondary btn-xs" id="applySupportingBtn" ${currentItem.supporting_tags ? '' : 'disabled'}>Apply</button>
    </div>
    <div class="field-row">
      <span class="field-key">Description</span>
      <span class="field-val" title="${currentItem.description}">${currentItem.description || '<span style="color:#64748b;font-style:italic;">(empty)</span>'}</span>
      <button class="btn btn-secondary btn-xs" id="applyDescBtn" ${currentItem.description ? '' : 'disabled'}>Apply</button>
    </div>
    <div class="field-row">
      <span class="field-key">Color HEX</span>
      <span class="field-val" title="${currentItem.background_color}">${currentItem.background_color || '<span style="color:#64748b;font-style:italic;">(empty)</span>'}</span>
      <button class="btn btn-secondary btn-xs" id="applyColorBtn" ${currentItem.background_color ? '' : 'disabled'}>Apply</button>
    </div>
  `;

  // Attach listeners to individual field buttons
  document.getElementById('applyTitleBtn')?.addEventListener('click', () => sendActionToTab('SET_FIELD', { field: 'title', value: currentItem.title }));
  document.getElementById('applyMainTagBtn')?.addEventListener('click', () => sendActionToTab('SET_FIELD', { field: 'main_tag', value: currentItem.main_tag }));
  document.getElementById('applySupportingBtn')?.addEventListener('click', () => sendActionToTab('SET_FIELD', { field: 'supporting_tags', value: currentItem.supporting_tags }));
  document.getElementById('applyDescBtn')?.addEventListener('click', () => sendActionToTab('SET_FIELD', { field: 'description', value: currentItem.description }));
  document.getElementById('applyColorBtn')?.addEventListener('click', () => sendActionToTab('SET_FIELD', { field: 'background_color', value: currentItem.background_color }));

  document.getElementById('applyImageBtn')?.addEventListener('click', async () => {
    const payload = await ImageDB.getImagePayload(currentItem.image_filename);
    if (payload) {
      sendActionToTab('ATTACH_IMAGE', payload);
    } else {
      logMsg(`Image '${currentItem.image_filename}' not found in store.`);
    }
  });

  // Update progress bar
  const progressPct = ((currentIndex + 1) / parsedDataset.length) * 100;
  progressBarFill.style.width = `${progressPct}%`;
}

// Send Action to Active Tab Content Script
function sendActionToTab(action, payload = {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      logMsg('Error: No active tab found.');
      return;
    }
    const tabId = tabs[0].id;

    function attemptSend() {
      chrome.tabs.sendMessage(tabId, { action, ...payload }, (res) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          logMsg(`Tab Error: ${errMsg}`);

          if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
            logMsg('Injecting content script into target tab...');
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                logMsg(`Injection Error: ${chrome.runtime.lastError.message}`);
              } else {
                logMsg('Script injected. Retrying action...');
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { action, ...payload }, (retryRes) => {
                    if (retryRes && retryRes.status) {
                      logMsg(`Action ${action}: ${retryRes.status}`);
                    }
                  });
                }, 300);
              }
            });
          }
        } else if (res && res.status) {
          logMsg(`Action ${action}: ${res.status}`);
        }
      });
    }

    attemptSend();
  });
}

// Quick Page Action Triggers
triggerEnableProducts.addEventListener('click', () => sendActionToTab('ENABLE_PRODUCTS'));
triggerTickMedia.addEventListener('click', () => sendActionToTab('TICK_MEDIA'));
triggerDefaultOptimized.addEventListener('click', () => sendActionToTab('DEFAULT_OPTIMIZED'));
triggerPublicVisibility.addEventListener('click', () => sendActionToTab('VISIBILITY_PUBLIC'));
triggerMatureNo.addEventListener('click', () => sendActionToTab('MATURE_NO'));
triggerUserAgreement.addEventListener('click', () => sendActionToTab('TICK_AGREEMENT'));

triggerApplyAllForm.addEventListener('click', async () => {
  if (parsedDataset.length === 0) {
    logMsg('Please load a folder or dataset first.');
    return;
  }
  const item = parsedDataset[currentIndex];
  logMsg(`Applying full form for item #${currentIndex + 1}: ${item.title}...`);

  const imgPayload = await ImageDB.getImagePayload(item.image_filename);

  sendActionToTab('APPLY_ALL_FORM', {
    item,
    imagePayload: imgPayload,
    autoSave: autoSaveToggle.checked
  });

  if (autoSaveToggle.checked && currentIndex < parsedDataset.length - 1) {
    setTimeout(() => {
      currentIndex++;
      chrome.storage.local.set({ batchIndex: currentIndex });
      updateInspector();
      logMsg(`🔄 Advanced Item Inspector to Item #${currentIndex + 1}: ${parsedDataset[currentIndex].title}`);
    }, 1500);
  }
});

// Automated Batch Controls (Start, Pause/Break, Stop Instantly, Restart)
startBatchBtn.addEventListener('click', () => {
  if (parsedDataset.length === 0) {
    logMsg('Cannot start batch: No dataset loaded.');
    return;
  }
  logMsg('🚀 Starting automated batch upload sequence...');
  chrome.runtime.sendMessage({
    action: 'START_BATCH',
    items: parsedDataset,
    startIndex: currentIndex,
    autoSave: autoSaveToggle.checked,
    filenameAgnostic: filenameAgnosticToggle.checked,
    uploadLoop: uploadLoopToggle ? uploadLoopToggle.checked : true,
    humanizedDelay: humanizedDelayToggle ? humanizedDelayToggle.checked : true
  });
});

pauseBatchBtn.addEventListener('click', () => {
  logMsg('⏸ Pausing batch sequence...');
  chrome.runtime.sendMessage({ action: 'PAUSE_BATCH' });
});

stopBatchBtn.addEventListener('click', () => {
  logMsg('⏹ Stopping batch sequence instantly...');
  chrome.runtime.sendMessage({ action: 'STOP_BATCH' });
});

restartBatchBtn.addEventListener('click', () => {
  if (parsedDataset.length === 0) {
    logMsg('Cannot restart batch: No dataset loaded.');
    return;
  }
  logMsg('🔄 Restarting batch sequence from item #1...');
  currentIndex = 0;
  chrome.storage.local.set({ batchIndex: 0 });
  updateInspector();
  chrome.runtime.sendMessage({
    action: 'RESTART_BATCH',
    items: parsedDataset,
    startIndex: 0,
    autoSave: autoSaveToggle.checked,
    filenameAgnostic: filenameAgnosticToggle.checked,
    uploadLoop: uploadLoopToggle ? uploadLoopToggle.checked : true,
    humanizedDelay: humanizedDelayToggle ? humanizedDelayToggle.checked : true
  });
});

// Listen for progress messages from background service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'BATCH_PROGRESS') {
    currentIndex = message.index;
    chrome.storage.local.set({ batchIndex: currentIndex });
    updateInspector();
    logMsg(`[Batch ${message.index + 1}/${parsedDataset.length}] ${message.status}`);
  }
});
