// Auto Uploader v1.2.0 - content.js

console.log("%c[Auto Uploader v1.2.0] Content script loaded.", "color: #ec4899; font-weight: bold;");

// Utility: Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Native React Value Setters
function setNativeInputValue(element, value) {
  if (!element) return;
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function setNativeTextAreaValue(element, value) {
  if (!element) return;
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// 1. Attach Image File via DataTransfer
async function attachImageFile(filename, mimeType, base64Data) {
  try {
    const fileInput = document.querySelector('input[type="file"]') || 
                      document.querySelector('#select-image-single') ||
                      document.querySelector('input[accept*="image"]');
    
    if (!fileInput) {
      return { status: "Error: Redbubble file uploader input not found." };
    }

    // Convert base64 to Blob
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: mimeType || 'image/png' });

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    return { status: `Success: Image ${filename} attached successfully.` };
  } catch (err) {
    console.error("[Auto Uploader] Attach image error:", err);
    return { status: `Error attaching image: ${err.message}` };
  }
}

// Native input & contenteditable setter helper
function setGenericField(selectors, value) {
  if (value === undefined || value === null || value === '') return false;

  for (let sel of selectors) {
    try {
      const elems = document.querySelectorAll(sel);
      for (let elem of elems) {
        if (!elem) continue;

        // Handle contenteditable / textbox role (e.g. #main-tag-en, #supporting-tags-en)
        if (elem.isContentEditable || elem.getAttribute('contenteditable') === 'true' || elem.getAttribute('role') === 'textbox') {
          elem.focus();
          elem.innerText = value;
          elem.textContent = value;
          elem.dispatchEvent(new Event('focus', { bubbles: true }));
          elem.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
          elem.dispatchEvent(new Event('change', { bubbles: true }));
          elem.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }

        // Handle standard <input> or <textarea>
        if (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA') {
          const proto = elem.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const valueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (valueSetter) {
            valueSetter.call(elem, value);
          } else {
            elem.value = value;
          }
          elem.dispatchEvent(new Event('focus', { bubbles: true }));
          elem.dispatchEvent(new Event('input', { bubbles: true }));
          elem.dispatchEvent(new Event('change', { bubbles: true }));
          elem.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
      }
    } catch (err) {
      console.warn(`[Auto Uploader] Selector '${sel}' query skipped:`, err);
    }
  }
  return false;
}

// 2. Set Field Logic (Title, Main Tag, Supporting Tags, Description, HEX Color)
function setFieldValue(field, value) {
  if (!value) return { status: `Skipped ${field}: Value is empty.` };

  if (field === 'title') {
    const titleSelectors = [
      '#work_title_en',
      'input[name="work[title_en]"]',
      'input[id^="work_title"]',
      '#work_title',
      'input[name="work[title]"]',
      'input[placeholder*="Title" i]',
      'input[placeholder*="Great Wave" i]'
    ];
    if (setGenericField(titleSelectors, value)) {
      return { status: `Title set to "${value}"` };
    }
    return { status: "Title input field not found." };
  }

  if (field === 'main_tag') {
    const mainTagSelectors = [
      '#main-tag-en',
      'span[id*="main-tag"]',
      '[id*="main-tag"]',
      'span[aria-placeholder*="Mountain" i]',
      '#work_tag_editor_en',
      'input[name="work[tag_field_en]"]',
      '#work_tag',
      '#work_tag_field',
      'input[name="work[tag]"]',
      'input[placeholder*="Main tag" i]'
    ];
    if (setGenericField(mainTagSelectors, value)) {
      setGenericField(['#work_tag_editor_en', 'input[name="work[tag_field_en]"]'], value);
      return { status: `Main tag set to "${value}"` };
    }
    return { status: "Main tag input field not found." };
  }

  if (field === 'supporting_tags') {
    const supportingSelectors = [
      '#supporting-tags-en',
      'span[id*="supporting-tags"]',
      '[id*="supporting-tags"]',
      'span[aria-placeholder*="nature" i]',
      '#work_tag_list',
      'textarea[name="work[tag_list]"]',
      'textarea[id*="supporting"]',
      'textarea[placeholder*="camping" i]'
    ];
    if (setGenericField(supportingSelectors, value)) {
      return { status: "Supporting tags set." };
    }
    return { status: "Supporting tags input field not found." };
  }

  if (field === 'description') {
    const descSelectors = [
      '#work_description_en',
      'textarea[name="work[description_en]"]',
      'textarea[id^="work_description"]',
      '#work_description',
      'textarea[name="work[description]"]',
      'textarea[placeholder*="camping" i]',
      'textarea[placeholder*="description" i]'
    ];
    if (setGenericField(descSelectors, value)) {
      return { status: "Description set." };
    }
    return { status: "Description textarea not found." };
  }

  if (field === 'background_color') {
    let hex = value.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    const colorSelectors = [
      '#work_bg_color',
      'input[name="work[bg_color]"]',
      'input[type="color"]',
      '.background-color-global',
      'input[placeholder*="#" i]'
    ];
    if (setGenericField(colorSelectors, hex)) {
      return { status: `Background HEX set to ${hex}` };
    }
    return { status: "Background color picker not found." };
  }

  return { status: `Unknown field: ${field}` };
}

// 3. Multi-Pass Smooth Scrolling & Category Product Enablement
async function enableAllProductCategories() {
  let totalEnabledCount = 0;

  // 1. Multi-pass smooth scroll down and up to force dynamic lazy rendering of product preview cards
  const totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 4000);
  const step = 350;
  for (let top = 0; top < totalHeight; top += step) {
    window.scrollTo({ top, behavior: 'instant' });
    await sleep(40);
  }
  await sleep(200);
  for (let top = totalHeight; top >= 0; top -= step) {
    window.scrollTo({ top, behavior: 'instant' });
    await sleep(20);
  }
  await sleep(300);

  // Helper to click element reliably with native MouseEvents
  function forceClick(elem) {
    if (!elem) return;
    try {
      elem.focus?.();
      elem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      elem.dispatchEvent(new Event('focus', { bubbles: true }));
      elem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      elem.click();
      elem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
      console.warn("[Auto Uploader] forceClick warning:", e);
    }
  }

  function runEnablePass() {
    let passCount = 0;

    // Strategy 0: Direct Redbubble Native Category Enable Buttons (.enable-all)
    const rbEnableButtons = document.querySelectorAll('.enable-all, div.enable-all, .rb-button.enable-all, [class*="enable-all"]');
    rbEnableButtons.forEach(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (!txt.includes('disable-all') && !btn.className.includes('disable-all')) {
        forceClick(btn);
        passCount++;
      }
    });

    // Strategy A: Direct Product Checkboxes
    const productCheckboxes = document.querySelectorAll(
      'input[type="checkbox"][name*="product"], input[type="checkbox"][id*="product"], input[type="checkbox"][name*="enabled"], input[type="checkbox"][id*="enable"]'
    );
    productCheckboxes.forEach(cb => {
      if (!cb.checked) {
        forceClick(cb);
        passCount++;
      }
    });

    // Strategy B: Scan all buttons, links, div/span toggles across the DOM
    const candidates = document.querySelectorAll(
      'button, a, div[role="button"], span[role="button"], label, div[class*="toggle"], span[class*="toggle"], div[class*="enable"], button[class*="disabled"], div.rb-button'
    );

    candidates.forEach(elem => {
      const txt = (elem.textContent || '').trim().toLowerCase();
      const ariaChecked = elem.getAttribute('aria-checked');
      const dataState = elem.getAttribute('data-state');
      const className = (elem.className || '').toString().toLowerCase();
      const idName = (elem.id || '').toString().toLowerCase();

      // Properly distinguish 'disabled' from 'enabled' (note: "disabled".includes("enabled") is TRUE in JS!)
      const isAlreadyEnabled = (txt.includes('enabled') && !txt.includes('disabled')) || dataState === 'on' || ariaChecked === 'true' || className.includes('disable-all');
      const isDisabledText = txt.includes('disabled') || txt === 'off' || txt === '+ disabled' || txt.includes('enable product') || txt.includes('enable all');
      const isDisabledState = dataState === 'off' || dataState === 'disabled' || ariaChecked === 'false' || (className.includes('disabled') && !className.includes('enabled'));

      if ((isDisabledText || isDisabledState) && !isAlreadyEnabled) {
        forceClick(elem);
        passCount++;
      }
    });

    // Strategy C: Redbubble Product Card Container Specific Toggles
    const cardContainers = document.querySelectorAll(
      '.work-product-card, .product-card, .grid-item, [class*="product-card"], [class*="ProductCard"], [data-testid*="product"]'
    );

    cardContainers.forEach(card => {
      const toggleBtn = card.querySelector('button, [role="button"], .toggle, input[type="checkbox"], .enable-all');
      if (toggleBtn) {
        const txt = (toggleBtn.textContent || '').trim().toLowerCase();
        const isEnabled = (txt.includes('enabled') && !txt.includes('disabled')) || toggleBtn.checked;
        if (!isEnabled) {
          forceClick(toggleBtn);
          passCount++;
        }
      }
    });

    return passCount;
  }

  // Pass 1
  totalEnabledCount += runEnablePass();
  await sleep(400);
  // Pass 2 (catch any newly mounted React elements)
  totalEnabledCount += runEnablePass();

  return { status: `Enabled ${totalEnabledCount} product category controls across the page.` };
}

// 4. Tick Media Options
function tickMediaOptions() {
  let count = 0;
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    const val = (cb.value || '').toLowerCase();
    const id = (cb.id || '').toLowerCase();
    const name = (cb.name || '').toLowerCase();
    const parentText = (cb.parentElement?.textContent || '').toLowerCase();

    const isDesign = val.includes('design') || id.includes('design') || name.includes('design') || parentText.includes('design & illustration');
    const isDigital = val.includes('digital') || id.includes('digital') || name.includes('digital') || parentText.includes('digital art');

    if ((isDesign || isDigital) && !cb.checked) {
      cb.click();
      count++;
    }
  });
  return { status: `Ticked ${count} media option checkboxes.` };
}

// 5. Default Product in Shop: Optimized
function setDefaultProductOptimized() {
  const select = document.querySelector('#work_default_product') ||
                 document.querySelector('select[name="work[default_product]"]') ||
                 document.querySelector('select[id*="default_product"]');
  if (select) {
    for (let opt of select.options) {
      if (opt.value.toLowerCase().includes('optim') || opt.text.toLowerCase().includes('optim')) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { status: `Default product set to: ${opt.text}` };
      }
    }
  }
  return { status: "Default product select element not found." };
}

// 6. Set Public Visibility
function setPublicVisibility() {
  const publicRadio = document.querySelector('#work_public_true') ||
                      document.querySelector('input[name="work[public]"][value="true"]') ||
                      document.querySelector('input[name="work[public]"][value="1"]') ||
                      document.querySelector('input[id*="public_true"]');
  if (publicRadio) {
    if (!publicRadio.checked) publicRadio.click();
    return { status: "Visibility set to Public." };
  }
  return { status: "Public visibility radio button not found." };
}

// 7. Set Mature Content: NO
function setMatureContentNo() {
  const safeRadio = document.querySelector('#work_safe_for_work_true') ||
                    document.querySelector('input[name="work[safe_for_work]"][value="true"]') ||
                    document.querySelector('input[name="work[safe_for_work]"][value="1"]') ||
                    document.querySelector('input[id*="safe_for_work_true"]');
  if (safeRadio) {
    if (!safeRadio.checked) safeRadio.click();
    return { status: "Mature Content set to NO (Safe for work)." };
  }
  return { status: "Mature content radio button not found." };
}

// 8. Tick User Agreement
function tickUserAgreement() {
  const agreement = document.querySelector('#rightsDeclaration') ||
                    document.querySelector('input[name="rightsDeclaration"]') ||
                    document.querySelector('input[id*="rights"]') ||
                    document.querySelector('input[name*="rights"]');
  if (agreement) {
    if (!agreement.checked) agreement.click();
    return { status: "User Rights Agreement ticked." };
  }
  return { status: "User Rights Agreement checkbox not found." };
}

// 9. Apply ALL Form & Product Options
async function applyAllFormAndOptions(item, autoSave, imagePayload = null) {
  const results = [];

  // Attach Image if payload passed
  if (imagePayload && imagePayload.base64Data) {
    const imgRes = await attachImageFile(imagePayload.filename, imagePayload.mimeType, imagePayload.base64Data);
    results.push(imgRes.status);
    await sleep(500);
  }

  if (item.title) results.push(setFieldValue('title', item.title).status);
  if (item.main_tag) results.push(setFieldValue('main_tag', item.main_tag).status);
  if (item.supporting_tags) results.push(setFieldValue('supporting_tags', item.supporting_tags).status);
  if (item.description) results.push(setFieldValue('description', item.description).status);
  if (item.background_color) results.push(setFieldValue('background_color', item.background_color).status);

  // Enable products
  const enableRes = await enableAllProductCategories();
  results.push(enableRes.status);

  // Bottom Settings
  results.push(tickMediaOptions().status);
  results.push(setDefaultProductOptimized().status);
  results.push(setPublicVisibility().status);
  results.push(setMatureContentNo().status);
  results.push(tickUserAgreement().status);

  // Optional Save Work
  if (autoSave) {
    await sleep(600);
    const submitBtn = document.querySelector('#submit-work') ||
                      document.querySelector('button#submit-work') ||
                      document.querySelector('input[type="submit"][id*="submit"]');
    if (submitBtn) {
      submitBtn.click();
      results.push("🚀 Save Work (#submit-work) clicked automatically!");
    } else {
      results.push("Save Work button not found.");
    }
  } else {
    results.push("Auto Save Work disabled - paused for manual inspection.");
  }

  return { status: results.join(" | ") };
}

// 10. Floating On-Screen HUD & Visual Feedback Overlay
function showOnScreenHUD(msg) {
  let hud = document.getElementById('rb-uploader-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'rb-uploader-hud';
    hud.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 999999;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #f8fafc;
      border: 1px solid #8b5cf6;
      border-radius: 8px;
      padding: 10px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(hud);
  }
  hud.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span> ${msg}`;
}

// Helper to click element reliably with native MouseEvents
function forceClickElement(elem) {
  if (!elem) return;
  try {
    elem.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    elem.focus?.();
    elem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    elem.dispatchEvent(new Event('focus', { bubbles: true }));
    elem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    elem.click();
    elem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch (e) {
    console.warn("[Auto Uploader] forceClickElement warning:", e);
  }
}

// 11. Upload Loop Helpers (Post-Publish Navigation with Visual Highlights)
function clickAddAnotherDesign() {
  showOnScreenHUD("👉 Looking for 'Add another design' link...");
  const links = document.querySelectorAll('a, button, span');
  for (let link of links) {
    const txt = (link.textContent || '').trim().toLowerCase();
    const href = (link.getAttribute?.('href') || '').toLowerCase();
    if (txt.includes('add another design') || href.includes('/portfolio/images/new')) {
      link.style.outline = "3px solid #22c55e";
      link.style.borderRadius = "4px";
      showOnScreenHUD("✅ Clicked 'Add another design' link!");
      forceClickElement(link);
      return { status: "Clicked 'Add another design' link successfully." };
    }
  }

  // Fallback: direct navigation to new work URL
  showOnScreenHUD("➡️ Navigating to 'Add New Work'...");
  window.location.href = "https://www.redbubble.com/portfolio/images/new";
  return { status: "Redirected to 'Add new work' page directly." };
}

async function clickUploadNewWork(imagePayload = null) {
  showOnScreenHUD("👉 Looking for 'Upload new work' card...");

  // 1. Locate and click 'Upload new work' card
  const candidates = document.querySelectorAll('div, button, a, span, label, h1, h2, h3');
  let clickedCard = false;
  for (let elem of candidates) {
    const txt = (elem.textContent || '').trim().toLowerCase();
    if (txt === 'upload new work' || (txt.includes('upload new work') && txt.length < 35)) {
      const parentCard = elem.closest('div, a, button, label') || elem;
      parentCard.style.outline = "3px solid #8b5cf6";
      parentCard.style.borderRadius = "8px";
      showOnScreenHUD("✅ Clicked 'Upload new work' card!");
      forceClickElement(parentCard);
      clickedCard = true;
      break;
    }
  }

  // 2. If imagePayload is provided (or retrieved from storage), attach it automatically!
  if (!imagePayload) {
    try {
      const storageData = await new Promise(resolve => chrome.storage.local.get(['lastUploadedImage'], resolve));
      if (storageData && storageData.lastUploadedImage) {
        imagePayload = storageData.lastUploadedImage;
      }
    } catch (e) {}
  }

  if (imagePayload && imagePayload.base64Data) {
    showOnScreenHUD(`🖼️ Auto-uploading saved image '${imagePayload.filename}'...`);
    await sleep(600);
    const attachRes = await attachImageFile(imagePayload.filename, imagePayload.mimeType, imagePayload.base64Data);
    showOnScreenHUD(`✅ Attached image (${imagePayload.filename})! Ready for next JSON.`);
    return { status: `Clicked 'Upload new work' and auto-attached image '${imagePayload.filename}'.` };
  }

  // Fallback: trigger file selector directly
  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) {
    fileInput.click();
    showOnScreenHUD("✅ Triggered file uploader directly!");
    return { status: "Triggered file input directly." };
  }

  return { status: "Card 'Upload new work' clicked." };
}

// -------------------------------------------------------------
// TeePublic Auto Uploader Module
// -------------------------------------------------------------

// 1. Attach Image File for TeePublic
async function attachTeePublicImage(filename, mimeType, base64Data) {
  try {
    const fileInput = document.querySelector('#design_primary_image_file') ||
                      document.querySelector('input[type="file"][name*="design"]') ||
                      document.querySelector('input[type="file"]');
    
    if (!fileInput) {
      return { status: "Error: TeePublic file uploader input not found." };
    }

    const res = await fetch(base64Data);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: mimeType || 'image/png' });

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    return { status: `Success: TeePublic image ${filename} attached.` };
  } catch (err) {
    return { status: `Error attaching TeePublic image: ${err.message}` };
  }
}

// 2. Set TeePublic Fields (Title, Main Tag, Supporting Tags, Description, Mature Content NO, Terms)
function setTeePublicFields(item) {
  const results = [];

  // 1. Title
  if (item.title) {
    const titleSelectors = [
      '#design_title',
      'input[name="design[title]"]',
      'input[name="title"]',
      'input[placeholder="Title"]'
    ];
    if (setGenericField(titleSelectors, item.title)) {
      results.push(`Title: "${item.title}"`);
    } else {
      results.push("Title field not found.");
    }
  }

  // 2. Main Tag (Exact HTML ID: #design_primary_tag, Name: design[primary_tag])
  if (item.main_tag) {
    const mainTagSelectors = [
      '#design_primary_tag',
      'input[name="design[primary_tag]"]',
      '#design_main_tag',
      'input[name="design[main_tag]"]'
    ];
    if (setGenericField(mainTagSelectors, item.main_tag)) {
      results.push(`Main Tag: "${item.main_tag}"`);
    } else {
      results.push("Main tag field not found.");
    }
  }

  // 3. Supporting Tags (Exact HTML ID: #design_secondary_tags, Name: design[secondary_tags])
  if (item.supporting_tags) {
    let tagsList = [];
    if (typeof item.supporting_tags === 'string') {
      const raw = item.supporting_tags.trim();
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try { tagsList = JSON.parse(raw); } catch (e) { tagsList = raw.split(/[,;\n]+/); }
      } else {
        tagsList = raw.split(/[,;\n]+/);
      }
    } else if (Array.isArray(item.supporting_tags)) {
      tagsList = item.supporting_tags;
    }

    tagsList = tagsList.map(t => String(t).trim()).filter(Boolean);

    // Apply 75% tag limit constraint
    if (tagsList.length > 0) {
      const count75 = Math.max(1, Math.ceil(tagsList.length * 0.75));
      tagsList = tagsList.slice(0, count75);
    }

    const ta = document.querySelector(
      '#design_secondary_tags, textarea[name="design[secondary_tags]"], #design_tag_list, #design_tags, textarea[name="design[tags]"], textarea[placeholder*="commas" i]'
    );

    let suppOk = false;

    if (ta) {
      ta.focus();
      const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

      let currentText = '';

      // Sequence: Paste first tag -> type one comma -> repeat until last tag
      tagsList.forEach((tag, idx) => {
        // Step A: Paste tag
        currentText += tag;
        if (setter) setter.call(ta, currentText); else ta.value = currentText;
        ta.dispatchEvent(new Event('focus', { bubbles: true }));
        ta.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: tag }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));

        // Step B: Type one comma ',' (unless last tag)
        if (idx < tagsList.length - 1) {
          currentText += ', ';
          if (setter) setter.call(ta, currentText); else ta.value = currentText;
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));
          ta.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ',' }));
          ta.dispatchEvent(new KeyboardEvent('keyup', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      ta.dispatchEvent(new Event('blur', { bubbles: true }));
      suppOk = true;
    } else {
      // Direct fallback using setGenericField
      const formatted = tagsList.join(', ');
      suppOk = setGenericField([
        '#design_secondary_tags',
        'textarea[name="design[secondary_tags]"]',
        '#design_tag_list',
        '#design_tags',
        'textarea[placeholder*="commas" i]'
      ], formatted);
    }

    if (suppOk) {
      results.push(`Supporting tags set (${tagsList.length} tags / 75%).`);
    } else {
      results.push("Supporting tags field not found.");
    }
  }

  // 4. Description
  if (item.description) {
    const descSelectors = [
      '#design_description',
      'textarea[name="design[description]"]',
      'textarea[name="description"]',
      'textarea[placeholder*="Describe your design" i]'
    ];
    if (setGenericField(descSelectors, item.description)) {
      results.push("Description set.");
    } else {
      results.push("Description field not found.");
    }
  }

  // 5. Mature Content: NO (Exact HTML ID: #mature_no, Name: design[mature], Value: false)
  const matureNoRadio = document.querySelector('#mature_no') ||
                        document.querySelector('input[name="design[mature]"][value="false"]') ||
                        document.querySelector('#design_is_mature_false') ||
                        document.querySelector('input[name="design[is_mature]"][value="false"]');
  if (matureNoRadio) {
    matureNoRadio.checked = true;
    forceClickElement(matureNoRadio);
    matureNoRadio.dispatchEvent(new Event('change', { bubbles: true }));
    matureNoRadio.dispatchEvent(new Event('click', { bubbles: true }));
    results.push("Mature Content set to NO.");
  } else {
    // Label click fallback
    let matureSet = false;
    const labels = document.querySelectorAll('.radio-inline, label');
    for (let lbl of labels) {
      if (lbl.textContent.trim().toLowerCase().startsWith('no')) {
        forceClickElement(lbl);
        const r = lbl.querySelector('input[type="radio"]');
        if (r) r.checked = true;
        matureSet = true;
        results.push("Mature Content set to NO.");
        break;
      }
    }
    if (!matureSet) results.push("Mature Content radio button not found.");
  }

  // 6. Terms Checkbox
  const termsCb = document.querySelector('#design_terms_and_conditions, input[name="design[terms_and_conditions]"], input[type="checkbox"][name*="terms"]');
  if (termsCb) {
    if (!termsCb.checked) {
      termsCb.checked = true;
      forceClickElement(termsCb);
    }
    results.push("Terms & Conditions checked.");
  }

  return { status: results.join(" | ") };
}

// 3. Enable All TeePublic Product Categories & Swatches
async function enableTeePublicProducts() {
  let enabledCount = 0;

  // 1. Click 'All' under Product Colors if available
  const allColorBtns = document.querySelectorAll('.product-colors button, [class*="product-colors"] button, button, a');
  allColorBtns.forEach(btn => {
    if ((btn.textContent || '').trim().toLowerCase() === 'all') {
      forceClickElement(btn);
    }
  });

  // 2. Target TeePublic product enable checkboxes & switches (e.g. name="products[tshirt][enabled]")
  const productCheckboxes = document.querySelectorAll(
    'input[type="checkbox"][name*="products"], input[type="checkbox"][name*="[enabled]"], .products-table input[type="checkbox"], .products-selection-container input[type="checkbox"], label.switch input[type="checkbox"]'
  );

  productCheckboxes.forEach(cb => {
    const id = (cb.id || '').toLowerCase();
    const name = (cb.name || '').toLowerCase();
    if (!id.includes('terms') && !name.includes('terms') && !id.includes('mature') && !name.includes('mature')) {
      if (!cb.checked) {
        cb.checked = true;
        forceClickElement(cb);
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        cb.dispatchEvent(new Event('click', { bubbles: true }));
        enabledCount++;
      }
    }
  });

  // 3. Fallback for custom toggle switch containers / sliders
  const offToggles = document.querySelectorAll('.slider, .switch, .off, [data-state="off"], [aria-checked="false"]');
  offToggles.forEach(elem => {
    const parentCb = elem.querySelector('input[type="checkbox"]') || elem.parentElement?.querySelector('input[type="checkbox"]');
    if (parentCb && !parentCb.checked) {
      parentCb.checked = true;
      forceClickElement(elem);
      parentCb.dispatchEvent(new Event('change', { bubbles: true }));
      enabledCount++;
    }
  });

  return { status: `Enabled TeePublic products (${enabledCount} controls toggled ON).` };
}

// 4. Publish TeePublic Form
function publishTeePublicForm(autoSave) {
  const termsCb = document.querySelector('#design_terms_and_conditions') ||
                  document.querySelector('input[name="design[terms_and_conditions]"]') ||
                  document.querySelector('input[type="checkbox"][name*="terms"]');
  if (termsCb && !termsCb.checked) {
    termsCb.click();
  }

  if (autoSave) {
    const publishBtn = document.querySelector('#publish') ||
                       document.querySelector('button[type="submit"]') ||
                       document.querySelector('input[type="submit"][value*="Publish" i]') ||
                       document.querySelector('button[class*="publish" i]');
    if (publishBtn) {
      publishBtn.click();
      return { status: "🚀 TeePublic PUBLISH button clicked!" };
    }
    return { status: "Publish button not found." };
  }
  return { status: "Form filled & ready for publish (Auto-Publish disabled)." };
}

// 5. Apply ALL TeePublic Form & Options
async function applyAllTeePublicForm(item, autoSave, imagePayload = null) {
  const results = [];

  if (imagePayload && imagePayload.base64Data) {
    const imgRes = await attachTeePublicImage(imagePayload.filename, imagePayload.mimeType, imagePayload.base64Data);
    results.push(imgRes.status);
    await sleep(500);
  }

  const fieldsRes = setTeePublicFields(item);
  results.push(fieldsRes.status);

  const productsRes = await enableTeePublicProducts();
  results.push(productsRes.status);

  const publishRes = publishTeePublicForm(autoSave);
  results.push(publishRes.status);

  return { status: results.join(" | ") };
}

function findSupportingTagsElement() {
  const searchDocs = [document];
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentDocument) searchDocs.push(iframe.contentDocument);
    } catch(e) {}
  });

  for (let doc of searchDocs) {
    const selectors = [
      '#design_secondary_tags',
      'textarea[name="design[secondary_tags]"]',
      '#design_tags',
      '#design_tag_list',
      'textarea[name="design[tags]"]',
      'textarea[name="design[tag_list]"]',
      'textarea[placeholder*="commas" i]',
      'textarea[placeholder*="tags" i]',
      'textarea[id*="tag" i]',
      'textarea[name*="tag" i]'
    ];

    for (let sel of selectors) {
      const elem = doc.querySelector(sel);
      if (elem) return elem;
    }

    const textareas = doc.querySelectorAll('textarea');
    for (let ta of textareas) {
      const id = (ta.id || '').toLowerCase();
      const name = (ta.name || '').toLowerCase();
      const ph = (ta.placeholder || '').toLowerCase();
      if (!id.includes('description') && !name.includes('description') && !ph.includes('describe')) {
        return ta;
      }
    }

    const inputs = doc.querySelectorAll('input[id*="tag" i], input[name*="tag" i]');
    for (let inp of inputs) {
      const id = (inp.id || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      if (!id.includes('primary') && !name.includes('primary') && !id.includes('main') && !name.includes('main')) {
        return inp;
      }
    }
  }

  return null;
}

// Dedicated Async Auto-Paste Tags with 1-Second Delay
async function autoPasteTeePublicTags(supporting_tags) {
  if (!supporting_tags) return { status: "No supporting tags provided." };

  let tagsList = [];
  if (typeof supporting_tags === 'string') {
    const raw = supporting_tags.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try { tagsList = JSON.parse(raw); } catch (e) { tagsList = raw.split(/[,;\n]+/); }
    } else {
      tagsList = raw.split(/[,;\n]+/);
    }
  } else if (Array.isArray(supporting_tags)) {
    tagsList = supporting_tags;
  }

  tagsList = tagsList.map(t => String(t).trim()).filter(Boolean);

  // Apply 75% limit constraint
  if (tagsList.length > 0) {
    const count75 = Math.max(1, Math.ceil(tagsList.length * 0.75));
    tagsList = tagsList.slice(0, count75);
  }

  const ta = findSupportingTagsElement();

  if (!ta) return { status: "Supporting tags input field not found on page." };

  ta.focus();
  const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  let currentText = '';

  for (let i = 0; i < tagsList.length; i++) {
    const tag = tagsList[i];

    // 1. Select & Paste Tag
    currentText += tag;
    if (setter) setter.call(ta, currentText); else ta.value = currentText;
    ta.dispatchEvent(new Event('focus', { bubbles: true }));
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: tag }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    // 2. Paste Comma
    currentText += ', ';
    if (setter) setter.call(ta, currentText); else ta.value = currentText;
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ',' }));
    ta.dispatchEvent(new KeyboardEvent('keyup', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    // 3. Pause 1 second before next tag (unless last tag)
    if (i < tagsList.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  ta.dispatchEvent(new Event('blur', { bubbles: true }));
  return { status: `🏷️ Auto-pasted ${tagsList.length} tags (75%) with 1s delays.` };
}

// Message Listener from Popup or Background Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    let res = { status: "Invalid action" };

    if (request.action === 'SHOW_HUD') {
      showOnScreenHUD(request.message);
      res = { status: "HUD updated." };
    } else if (request.action === 'SET_FIELD') {
      res = setFieldValue(request.field, request.value);
    } else if (request.action === 'ATTACH_IMAGE') {
      res = await attachImageFile(request.filename, request.mimeType, request.base64Data);
    } else if (request.action === 'ENABLE_PRODUCTS') {
      res = await enableAllProductCategories();
    } else if (request.action === 'TICK_MEDIA') {
      res = tickMediaOptions();
    } else if (request.action === 'DEFAULT_OPTIMIZED') {
      res = setDefaultProductOptimized();
    } else if (request.action === 'VISIBILITY_PUBLIC') {
      res = setPublicVisibility();
    } else if (request.action === 'MATURE_NO') {
      res = setMatureContentNo();
    } else if (request.action === 'TICK_AGREEMENT') {
      res = tickUserAgreement();
    } else if (request.action === 'APPLY_ALL_FORM') {
      res = await applyAllFormAndOptions(request.item || {}, request.autoSave, request.imagePayload);
    } else if (request.action === 'CLICK_ADD_ANOTHER_DESIGN') {
      res = clickAddAnotherDesign();
    } else if (request.action === 'CLICK_UPLOAD_NEW_WORK') {
      res = await clickUploadNewWork(request.imagePayload);
    } else if (request.action === 'TP_ATTACH_IMAGE') {
      res = await attachTeePublicImage(request.filename, request.mimeType, request.base64Data);
    } else if (request.action === 'TP_FILL_FORM') {
      res = setTeePublicFields(request.item || {});
    } else if (request.action === 'TP_AUTO_PASTE_TAGS') {
      res = await autoPasteTeePublicTags(request.supporting_tags || (request.item ? request.item.supporting_tags : ''));
    } else if (request.action === 'TP_ENABLE_PRODUCTS') {
      res = await enableTeePublicProducts();
    } else if (request.action === 'TP_PUBLISH') {
      res = publishTeePublicForm(request.autoSave);
    } else if (request.action === 'TP_APPLY_ALL_FORM') {
      res = await applyAllTeePublicForm(request.item || {}, request.autoSave, request.imagePayload);
    }

    sendResponse(res);
  })();

  return true; // Keep async response channel open
});
