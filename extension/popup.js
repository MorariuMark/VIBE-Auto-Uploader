// Auto Uploader v1.1.1 - popup.js

let parsedDataset = [];
let loadedPngMap = new Map(); // filename -> File object
let storedPngDataMap = {};   // filename -> { filename, mimeType, base64Data }
let currentIndex = 0;

// DOM Elements
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
const filenameAgnosticToggle = document.getElementById('filenameAgnosticToggle');
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

// Helper: Log message to UI
function logMsg(msg) {
  const timestamp = new Date().toLocaleTimeString();
  logBox.textContent = `[${timestamp}] ${msg}\n` + logBox.textContent;
}

// Restore saved settings on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['autoSaveWork', 'filenameAgnostic', 'batchItems', 'batchIndex', 'pngImages'], (data) => {
    if (data.autoSaveWork !== undefined) {
      autoSaveToggle.checked = data.autoSaveWork;
    }
    if (data.filenameAgnostic !== undefined) {
      filenameAgnosticToggle.checked = data.filenameAgnostic;
    }
    if (data.pngImages) {
      storedPngDataMap = data.pngImages;
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

filenameAgnosticToggle.addEventListener('change', () => {
  chrome.storage.local.set({ filenameAgnostic: filenameAgnosticToggle.checked });
  logMsg(`Filename Agnostic Mode set to: ${filenameAgnosticToggle.checked}`);
  updateInspector();
});

// Resolution Helper for PNG Image Files (With Filename Agnostic Fallback)
function getResolvedPngFile(targetFilename) {
  if (loadedPngMap.has(targetFilename)) {
    return loadedPngMap.get(targetFilename);
  }
  if (filenameAgnosticToggle.checked && loadedPngMap.size > 0) {
    return loadedPngMap.values().next().value;
  }
  return null;
}

function getResolvedPngDataObj(targetFilename) {
  if (storedPngDataMap[targetFilename]) {
    return storedPngDataMap[targetFilename];
  }
  if (filenameAgnosticToggle.checked) {
    const keys = Object.keys(storedPngDataMap);
    if (keys.length > 0) {
      return storedPngDataMap[keys[0]];
    }
  }
  return null;
}

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

// Handle JSON File Selection (Default)
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

// CSV Parser Helper
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  
  function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx] : '';
    });

    const image_filename = row.image_filename || row.image || row.filename || row.file || '';
    const title = row.title || row.design_title || row.name || '';
    const main_tag = row.main_tag || row.primary_tag || row.main_keyword || (row.tags ? row.tags.split(',')[0].trim() : '');
    const supporting_tags = row.supporting_tags || row.secondary_tags || row.tags_secondary || '';
    const description = row.description || row.desc || row.product_description || '';
    const background_color = row.background_color || row.hex || row.bg_color || row.color || '';

    rows.push({
      image_filename,
      title,
      main_tag,
      supporting_tags,
      description,
      background_color
    });
  }

  return rows;
}

// Handle CSV Selection
csvFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  csvFileLabel.textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = (evt) => {
    parsedDataset = parseCSVText(evt.target.result);
    currentIndex = 0;
    chrome.storage.local.set({ batchItems: parsedDataset, batchIndex: 0 });
    updateInspector();
    logMsg(`Loaded CSV with ${parsedDataset.length} rows.`);
  };
  reader.readAsText(file);
});

// Handle PNG Files Selection & Store Base64 Map
pngFilesInput.addEventListener('change', (e) => {
  const files = e.target.files;
  loadedPngMap.clear();
  storedPngDataMap = {};

  let readCount = 0;
  for (let file of files) {
    loadedPngMap.set(file.name, file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      storedPngDataMap[file.name] = {
        filename: file.name,
        mimeType: file.type || 'image/png',
        base64Data: evt.target.result
      };
      readCount++;
      if (readCount === files.length) {
        chrome.storage.local.set({ pngImages: storedPngDataMap });
        logMsg(`Loaded and stored ${files.length} PNG design images.`);
        updateInspector();
      }
    };
    reader.readAsDataURL(file);
  }

  pngFilesLabel.textContent = `🖼️ ${files.length} PNG Files Loaded`;
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
    fieldPreview.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px;">Load JSON or CSV to inspect metadata fields.</div>`;
    return;
  }

  itemCounter.textContent = `${currentIndex + 1} / ${parsedDataset.length}`;
  const currentItem = parsedDataset[currentIndex];
  
  const fileObj = getResolvedPngFile(currentItem.image_filename);
  const storedObj = getResolvedPngDataObj(currentItem.image_filename);
  const hasImage = !!fileObj || !!storedObj;
  const isAgnosticFallback = filenameAgnosticToggle.checked && (!loadedPngMap.has(currentItem.image_filename) && !storedPngDataMap[currentItem.image_filename]) && hasImage;

  fieldPreview.innerHTML = `
    <div class="field-row">
      <span class="field-key">Image</span>
      <span class="field-val" title="${currentItem.image_filename}">
        ${currentItem.image_filename || 'any_image.png'} ${hasImage ? (isAgnosticFallback ? '⚡ (agnostic)' : '✅') : '❌'}
      </span>
      <button class="btn btn-secondary btn-xs" id="applyImageBtn" ${hasImage ? '' : 'disabled'}>Attach</button>
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

  document.getElementById('applyImageBtn')?.addEventListener('click', () => {
    if (fileObj) {
      const reader = new FileReader();
      reader.onload = (e) => {
        sendActionToTab('ATTACH_IMAGE', {
          filename: fileObj.name,
          mimeType: fileObj.type || 'image/png',
          base64Data: e.target.result
        });
      };
      reader.readAsDataURL(fileObj);
    } else if (storedObj) {
      sendActionToTab('ATTACH_IMAGE', storedObj);
    }
  });

  // Update progress bar
  const progressPct = ((currentIndex + 1) / parsedDataset.length) * 100;
  progressBarFill.style.width = `${progressPct}%`;
}

// Send Action to Active Tab Content Script (With Auto-Injection Recovery)
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

triggerApplyAllForm.addEventListener('click', () => {
  if (parsedDataset.length === 0) {
    logMsg('Please load a CSV/JSON dataset first.');
    return;
  }
  const item = parsedDataset[currentIndex];
  logMsg(`Applying full form for item #${currentIndex + 1}: ${item.title}...`);

  const fileObj = getResolvedPngFile(item.image_filename);
  const storedObj = getResolvedPngDataObj(item.image_filename);

  function sendFormWithImagePayload(imgPayload) {
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
  }

  if (fileObj) {
    const reader = new FileReader();
    reader.onload = (e) => {
      sendFormWithImagePayload({
        filename: fileObj.name,
        mimeType: fileObj.type || 'image/png',
        base64Data: e.target.result
      });
    };
    reader.readAsDataURL(fileObj);
  } else {
    sendFormWithImagePayload(storedObj || null);
  }
});

// Automated Batch Runner Controls
startBatchBtn.addEventListener('click', () => {
  if (parsedDataset.length === 0) {
    logMsg('Cannot start batch: No dataset loaded.');
    return;
  }
  logMsg('🚀 Starting automated batch sequence...');
  chrome.runtime.sendMessage({
    action: 'START_BATCH',
    items: parsedDataset,
    pngImages: storedPngDataMap,
    startIndex: currentIndex,
    autoSave: autoSaveToggle.checked,
    filenameAgnostic: filenameAgnosticToggle.checked
  });
});

pauseBatchBtn.addEventListener('click', () => {
  logMsg('⏸ Pausing batch sequence...');
  chrome.runtime.sendMessage({ action: 'PAUSE_BATCH' });
});

stopBatchBtn.addEventListener('click', () => {
  logMsg('⏹ Stopping batch sequence...');
  chrome.runtime.sendMessage({ action: 'STOP_BATCH' });
});

// Listen for progress messages from background service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'BATCH_PROGRESS') {
    currentIndex = message.index;
    chrome.storage.local.set({ batchIndex: currentIndex });
    updateInspector();
    logMsg(`Batch item ${message.index + 1}/${parsedDataset.length}: ${message.status}`);
  }
});
