// Auto Uploader v1.5.1 - content.js (Stealth Edition)

console.log("%c[Auto Uploader v1.5.1] Content script loaded with telemetry protection & stealth mouse simulation.", "color: #ec4899; font-weight: bold;");

// Utility: Sleep helper with random jitter
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomJitter = (minMs, maxMs) => Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

// Human-like smooth scroll into view
async function humanScrollTo(elem) {
  if (!elem) return;
  try {
    const rect = elem.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - (window.innerHeight / 3);
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    await sleep(randomJitter(150, 300));
  } catch (e) {}
}

// Human-like text typing simulation (character-by-character with realistic keypress delays)
async function humanTypeIntoField(elem, text) {
  if (!elem || !text) return;
  await humanScrollTo(elem);
  elem.focus();
  await sleep(randomJitter(80, 180));

  const isTextArea = elem.tagName === 'TEXTAREA';
  const isInput = elem.tagName === 'INPUT';
  const proto = isTextArea ? HTMLTextAreaElement.prototype : (isInput ? HTMLInputElement.prototype : null);
  const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;

  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;

    if (setter) {
      setter.call(elem, current);
    } else if (elem.isContentEditable) {
      elem.textContent = current;
    } else {
      elem.value = current;
    }

    elem.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    elem.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
    elem.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

    // Slightly faster typing speed: 15ms to 40ms with short pauses after spaces or commas
    let delay = randomJitter(15, 40);
    if (char === ' ' || char === ',' || char === '.') {
      delay += randomJitter(40, 100);
    }
    await sleep(delay);
  }

  elem.dispatchEvent(new Event('change', { bubbles: true }));
  elem.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(randomJitter(100, 200));
}

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

// Native input & contenteditable setter helper with human typing simulation
async function setGenericField(selectors, value, useStealthTyping = true) {
  if (value === undefined || value === null || value === '') return false;

  for (let sel of selectors) {
    try {
      const elems = document.querySelectorAll(sel);
      for (let elem of elems) {
        if (!elem) continue;

        if (useStealthTyping) {
          await humanTypeIntoField(elem, String(value));
          return true;
        }

        // Handle contenteditable / textbox role (e.g. #main-tag-en, #supporting-tags-en)
        if (elem.isContentEditable || elem.getAttribute('contenteditable') === 'true' || elem.getAttribute('role') === 'textbox') {
          await humanScrollTo(elem);
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
          await humanScrollTo(elem);
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
async function setFieldValue(field, value) {
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
    if (await setGenericField(titleSelectors, value)) {
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
    if (await setGenericField(mainTagSelectors, value)) {
      await setGenericField(['#work_tag_editor_en', 'input[name="work[tag_field_en]"]'], value, false);
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
    if (await setGenericField(supportingSelectors, value)) {
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
    if (await setGenericField(descSelectors, value)) {
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
    if (await setGenericField(colorSelectors, hex, false)) {
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

  if (item.title) {
    const res = await setFieldValue('title', item.title);
    results.push(res.status);
    await sleep(randomJitter(500, 1200));
  }
  if (item.main_tag) {
    const res = await setFieldValue('main_tag', item.main_tag);
    results.push(res.status);
    await sleep(randomJitter(500, 1200));
  }
  if (item.supporting_tags) {
    const res = await setFieldValue('supporting_tags', item.supporting_tags);
    results.push(res.status);
    await sleep(randomJitter(500, 1200));
  }
  if (item.description) {
    const res = await setFieldValue('description', item.description);
    results.push(res.status);
    await sleep(randomJitter(500, 1200));
  }
  if (item.background_color) {
    const res = await setFieldValue('background_color', item.background_color);
    results.push(res.status);
    await sleep(randomJitter(500, 1200));
  }

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

// Helper to click element reliably with realistic human MouseEvent telemetry (non-zero coordinates, hover events)
function forceClickElement(elem) {
  if (!elem) return;
  try {
    elem.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    elem.focus?.();

    const rect = elem.getBoundingClientRect();
    const x = Math.max(1, Math.floor(rect.left + (rect.width * (0.2 + Math.random() * 0.6))));
    const y = Math.max(1, Math.floor(rect.top + (rect.height * (0.2 + Math.random() * 0.6))));

    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x + window.screenX, screenY: y + window.screenY };

    elem.dispatchEvent(new MouseEvent('mouseenter', opts));
    elem.dispatchEvent(new MouseEvent('mouseover', opts));
    elem.dispatchEvent(new MouseEvent('mousemove', opts));
    elem.dispatchEvent(new MouseEvent('mousedown', opts));
    elem.dispatchEvent(new Event('focus', { bubbles: true }));
    elem.dispatchEvent(new MouseEvent('mouseup', opts));
    elem.click();
    elem.dispatchEvent(new MouseEvent('click', opts));
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
async function setTeePublicFields(item) {
  const results = [];

  // 1. Title
  if (item.title) {
    const titleSelectors = [
      '#design_title',
      'input[name="design[title]"]',
      'input[name="title"]',
      'input[placeholder="Title"]'
    ];
    if (await setGenericField(titleSelectors, item.title)) {
      results.push(`Title: "${item.title}"`);
    } else {
      results.push("Title field not found.");
    }
    await sleep(randomJitter(500, 1200));
  }

  // 2. Main Tag (Exact HTML ID: #design_primary_tag, Name: design[primary_tag])
  if (item.main_tag) {
    const mainTagSelectors = [
      '#design_primary_tag',
      'input[name="design[primary_tag]"]',
      '#design_main_tag',
      'input[name="design[main_tag]"]'
    ];
    if (await setGenericField(mainTagSelectors, item.main_tag)) {
      results.push(`Main Tag: "${item.main_tag}"`);
    } else {
      results.push("Main tag field not found.");
    }
    await sleep(randomJitter(500, 1200));
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

    const ta = findSupportingTagsElement();
    let suppOk = false;

    if (ta) {
      if (!isWritableInput(ta)) {
        console.warn("[Auto Uploader] Found element for tags but it is not writable:", ta);
        results.push("Supporting tags field found but is not writable.");
      } else if (ta.classList.contains('taggle_input')) {
        const result = await writeTagsToTaggle(tagsList);
        suppOk = result && (result.startsWith('ok') || result.startsWith('simulated'));
        if (!suppOk) results.push('Taggle: ' + (result || 'failed'));
      } else {
        await humanScrollTo(ta);
        ta.focus();
        await sleep(randomJitter(100, 200));

        for (let i = 0; i < tagsList.length; i++) {
          const tag = tagsList[i];
          const textToType = (i > 0 ? ', ' : '') + tag;
          await humanTypeIntoField(ta, textToType);
          await sleep(randomJitter(200, 450)); // Small human delay between each supporting tag
        }
        suppOk = true;
      }
    }

    if (suppOk) {
      results.push(`Supporting tags set (${tagsList.length} tags).`);
    } else if (!ta) {
      results.push("Supporting tags field not found.");
    }
    await sleep(randomJitter(500, 1200));
  }

  // 4. Description
  if (item.description) {
    const descSelectors = [
      '#design_description',
      'textarea[name="design[description]"]',
      'textarea[name="description"]',
      'textarea[placeholder*="Describe your design" i]'
    ];
    if (await setGenericField(descSelectors, item.description)) {
      results.push("Description set.");
    } else {
      results.push("Description field not found.");
    }
    await sleep(randomJitter(500, 1200));
  }

  // 5. Mature Content: NO (Exact HTML ID: #mature_no, Name: design[mature], Value: false)
  const matureNoRadio = document.querySelector('#mature_no') ||
                        document.querySelector('input[name="design[mature]"][value="false"]') ||
                        document.querySelector('#design_is_mature_false') ||
                        document.querySelector('input[name="design[is_mature]"][value="false"]');
  if (matureNoRadio) {
    await humanScrollTo(matureNoRadio);
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
        await humanScrollTo(lbl);
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
  await sleep(randomJitter(400, 800));

  // 6. Terms Checkbox
  const termsCb = document.querySelector('#design_terms_and_conditions, input[name="design[terms_and_conditions]"], input[type="checkbox"][name*="terms"]');
  if (termsCb) {
    await humanScrollTo(termsCb);
    if (!termsCb.checked) {
      termsCb.checked = true;
      forceClickElement(termsCb);
    }
    results.push("Terms & Conditions checked.");
  }

  return { status: results.join(" | ") };
}

// 3. Enable All TeePublic Product Categories & Swatches (Clean content-script execution, humanized timing)
async function enableTeePublicProducts() {
  let toggleCount = 0, defaultColorCount = 0, bgCount = 0;

  try {
    // 1. Enable all product toggles that are OFF (one by one with realistic human delays)
    const allToggles = document.querySelectorAll('.canvas-selection div.on-off.canvas-enable');
    for (let toggle of allToggles) {
      const hidden = toggle.querySelector('input[type="hidden"]');
      let isOff = hidden && hidden.value === 'false';
      const span = toggle.querySelector('span');
      if (!isOff && span) {
        isOff = span.classList.contains('disabled');
      }
      if (isOff) {
        const clickable = toggle.querySelector('span.enabled, a, button') || toggle;
        await humanScrollTo(clickable);
        forceClickElement(clickable);
        toggleCount++;
        await sleep(randomJitter(200, 450)); // Humanized pause between product toggles
      }
    }

    // 2. Set default color dropdowns if unselected (one by one)
    const allDDs = document.querySelectorAll('.canvas-selection .dd-container');
    for (let dd of allDDs) {
      const selText = dd.querySelector('.dd-selected-text');
      const currentVal = selText ? (selText.textContent || '').trim() : '';
      if (currentVal.toLowerCase() === 'select default color' || currentVal.toLowerCase() === 'select default colour') {
        await humanScrollTo(dd);
        const ddSelect = dd.querySelector('.dd-select');
        if (ddSelect) forceClickElement(ddSelect);
        await sleep(randomJitter(200, 400));

        const opts = dd.querySelectorAll('.dd-option');
        for (let i = 0; i < opts.length; i++) {
          const optTextEl = opts[i].querySelector('.dd-option-text');
          const optText = optTextEl ? (optTextEl.textContent || '').trim() : '';
          if (optText && optText.toLowerCase() !== 'select default color' && optText.toLowerCase() !== 'select default colour') {
            forceClickElement(opts[i]);
            defaultColorCount++;
            await sleep(randomJitter(250, 450)); // Humanized pause after selecting color
            break;
          }
        }
      }
    }

    // 3. Set background color inputs to white
    const bgInputs = document.querySelectorAll('input[type="text"][name*="bg_color"]');
    for (let inp of bgInputs) {
      const proto = HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(inp, '#FFFFFF'); else inp.value = '#FFFFFF';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      bgCount++;
    }

    return { status: `TP Products enabled (toggles: ${toggleCount}, defaultColors: ${defaultColorCount}, bg: ${bgCount})` };
  } catch (e) {
    return { status: `TP Products error: ${e.message}` };
  }
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
    const publishBtn = document.querySelector('button.publish-and-promote-button') ||
                       document.querySelector('#publish') ||
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

// 5. Click TeePublic 'Upload Art' button (after publish, on the design/dashboard page)
function clickTeePublicUploadArt() {
  showOnScreenHUD("👉 Looking for 'Upload Art' button...");
  var candidates = document.querySelectorAll('a, button, span, div');
  for (var el of candidates) {
    var txt = (el.textContent || '').trim().toLowerCase();
    if (txt === 'upload art' || (txt.includes('upload art') && txt.length < 25)) {
      el.style.outline = "3px solid #22c55e";
      el.style.borderRadius = "4px";
      showOnScreenHUD("✅ Clicked 'Upload Art'!");
      forceClickElement(el);
      return { status: "Clicked 'Upload Art' button." };
    }
  }
  // Fallback: navigate directly to uploader
  showOnScreenHUD("➡️ Navigating to TeePublic uploader...");
  window.location.href = "https://www.teepublic.com/uploader";
  return { status: "Redirected to TeePublic uploader." };
}

// 6. Click TeePublic file upload button & attach next image
async function clickTeePublicUploadFile(imagePayload) {
  showOnScreenHUD("👉 Looking for TeePublic file upload area...");

  if (!imagePayload || !imagePayload.base64Data) {
    return { status: "No image payload provided." };
  }

  var fileInput = document.querySelector('#design_primary_image_file') ||
                  document.querySelector('input[type="file"][name*="design"]') ||
                  document.querySelector('input[type="file"]');
  if (fileInput) {
    var res = await fetch(imagePayload.base64Data);
    var blob = await res.blob();
    var file = new File([blob], imagePayload.filename, { type: imagePayload.mimeType || 'image/png' });
    var dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    showOnScreenHUD("✅ Uploaded image '" + imagePayload.filename + "'!");
    return { status: "Uploaded image '" + imagePayload.filename + "' via file input." };
  }

  // Fallback: click the upload button to trigger native file picker
  var uploadBtn = document.querySelector('.upload-button') ||
                  document.querySelector('[class*="upload"]') ||
                  document.querySelector('button:has(svg), button:has(.icon)');
  if (uploadBtn) {
    forceClickElement(uploadBtn);
    showOnScreenHUD("✅ Clicked upload button.");
    return { status: "Clicked upload button (manual file selection needed)." };
  }

  return { status: "No file input or upload button found." };
}

// 7. Apply ALL TeePublic Form & Options
async function applyAllTeePublicForm(item, autoSave, imagePayload = null) {
  const results = [];

  if (imagePayload && imagePayload.base64Data) {
    const imgRes = await attachTeePublicImage(imagePayload.filename, imagePayload.mimeType, imagePayload.base64Data);
    results.push(imgRes.status);
    await sleep(500);
  }

  const fieldsRes = await setTeePublicFields(item);
  results.push(fieldsRes.status);

  const productsRes = await enableTeePublicProducts();
  results.push(productsRes.status);

  if (autoSave) {
    var delaySec = 3 + Math.floor(Math.random() * 6);
    results.push('Waiting ' + delaySec + 's before publish...');
    await new Promise(function(r){ setTimeout(r, delaySec * 1000); });
  }

  const publishRes = publishTeePublicForm(autoSave);
  results.push(publishRes.status);

  return { status: results.join(" | ") };
}

function isWritableInput(el) {
  if (!el || el.disabled || el.readOnly) return false;
  const t = (el.type || '').toLowerCase();
  return t !== 'file' && t !== 'hidden' && t !== 'submit' && t !== 'button' && t !== 'checkbox' && t !== 'radio' && t !== 'image' && t !== 'reset';
}

function findSupportingTagsElement() {
  const searchDocs = [document];
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentDocument) searchDocs.push(iframe.contentDocument);
    } catch(e) {}
  });

  const writableSelector = 'textarea, input:not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="image"]):not([type="reset"]), [contenteditable="true"]';

  for (let doc of searchDocs) {
    // Tier 1: Exact known TeePublic tag field selectors
    const exactSelectors = [
      '#design_secondary_tags', 'textarea[name="design[secondary_tags]"]',
      '#design_tag_list', 'textarea[name="design[tag_list]"]',
      '#design_tags', 'textarea[name="design[tags]"]',
      '#tag_list', 'textarea[name="tag_list"]',
      '#tags_field', 'textarea[name="tags"]',
      'textarea[placeholder*="commas" i]',
      'textarea[placeholder*="tags" i]',
      'textarea[placeholder*="keywords" i]',
      'textarea[aria-label*="tag" i]',
      'textarea[aria-label*="keyword" i]',
      'textarea[data-preview*="tag" i]',
      'input.taggle_input'
    ];
    for (let sel of exactSelectors) {
      const elem = doc.querySelector(sel);
      if (elem && isWritableInput(elem)) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 1 match:', sel, elem);
        return elem;
      }
    }

    // Tier 2: Any textarea with tag/keyword in id, name, or class
    const allTextareas = doc.querySelectorAll('textarea');
    for (let ta of allTextareas) {
      if (!isWritableInput(ta)) continue;
      const id = (ta.id || '').toLowerCase();
      const name = (ta.name || '').toLowerCase();
      const ph = (ta.placeholder || '').toLowerCase();
      const cls = (ta.className || '').toLowerCase();
      if (id.includes('tag') || name.includes('tag') || ph.includes('tag') || cls.includes('tag') ||
          id.includes('keyword') || name.includes('keyword') || ph.includes('keyword') ||
          id.includes('secondary') || name.includes('secondary')) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 2 match:', ta);
        return ta;
      }
    }

    // Tier 3: Input elements with tag/keyword in attributes (no file inputs)
    const tagInputs = doc.querySelectorAll('input:not([type="file"])[id*="tag" i], input:not([type="file"])[name*="tag" i], input:not([type="file"])[placeholder*="tag" i], input:not([type="file"])[id*="keyword" i], input:not([type="file"])[name*="keyword" i]');
    for (let inp of tagInputs) {
      if (!isWritableInput(inp)) continue;
      const id = (inp.id || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      
      if (!id.includes('primary') && !name.includes('primary') && !id.includes('main') && !name.includes('main')) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 3 match (not primary/main):', inp);
        return inp;
      }
    }

    // Tier 3b: Elements with tag-related CSS class names (common in React components)
    
    const classTagged = doc.querySelectorAll('[class*="tag-input" i], [class*="tags-input" i], [class*="tag-field" i], [class*="tags-field" i], [class*="tag-editor" i], [class*="tokenizer" i], [class*="tag-list" i], [data-testid*="tag" i], [data-field-name*="tag" i]');
    for (let el of classTagged) {
      if (isWritableInput(el)) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 3b match:', el);
        return el;
      }
    }

    // Tier 3c: TeePublic's React-controlled tag input (type=text, no name attribute, no id)
    const unnamedInputs = doc.querySelectorAll('input[type="text"]:not([name]):not([id])');
    for (let inp of unnamedInputs) {
      if (isWritableInput(inp)) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 3c match:', inp, 'placeholder:', inp.placeholder, 'className:', inp.className);
        return inp;
      }
    }

    // Tier 4: Contenteditable divs used as tag editors
    const editable = doc.querySelectorAll('[contenteditable="true"]');
    for (let el of editable) {
      const id = (el.id || '').toLowerCase();
      const attrs = (el.getAttribute('aria-label') || '').toLowerCase() + (el.getAttribute('data-placeholder') || '').toLowerCase() + (el.getAttribute('placeholder') || '').toLowerCase();
      const clazz = (el.className || '').toLowerCase();
      if (id.includes('tag') || attrs.includes('tag') || clazz.includes('tag') ||
          id.includes('keyword') || attrs.includes('keyword')) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 4 match:', el);
        return el;
      }
    }

    // Tier 5: Writable inputs inside a section whose text mentions tags or keywords
    const tagSections = doc.querySelectorAll('section, fieldset, div, label');
    for (let section of tagSections) {
      const sectionText = (section.textContent || '').toLowerCase();
      if (!sectionText.includes('tag') && !sectionText.includes('keyword')) continue;
      const inputs = section.querySelectorAll(writableSelector);
      for (let inp of inputs) {
        if (isWritableInput(inp)) {
          console.log('[Auto Uploader findSupportingTagsElement] TIER 5 match:', inp);
          return inp;
        }
      }
    }

    // Tier 6: Any input linked to a label that says "tags" or "keywords"
    const labels = doc.querySelectorAll('label');
    for (let label of labels) {
      const labelText = (label.textContent || '').toLowerCase();
      if (!labelText.includes('tag') && !labelText.includes('keyword')) continue;
      const forId = label.getAttribute('for');
      if (forId) {
        const el = doc.getElementById(forId);
        if (el && isWritableInput(el)) {
          console.log('[Auto Uploader findSupportingTagsElement] TIER 6 match (for attr):', el);
          return el;
        }
      }
      const child = label.querySelector(writableSelector);
      if (child && isWritableInput(child)) {
        console.log('[Auto Uploader findSupportingTagsElement] TIER 6 match (child):', child);
        return child;
      }
    }
  }

  return null;
}

// Helper: Write tags to a Taggle input widget using its JS API
async function writeTagsToTaggle(tagsList) {
  // Approach 1: Try Taggle API via page-context script
  const apiResult = await tryTaggleAPI(tagsList);
  if (apiResult.startsWith('ok')) return apiResult;

  // Approach 2: Simulate typing each tag + pressing Enter
  return simulateTaggleInput(tagsList);
}

async function tryTaggleAPI(tagsList) {
  const bridge = document.createElement('div');
  bridge.id = '__tp_taggle_bridge';
  bridge.setAttribute('data-tags', JSON.stringify(tagsList));
  bridge.style.display = 'none';
  bridge.textContent = 'pending';
  document.body.appendChild(bridge);
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('tp_taggle_api.js');
  await new Promise(function(resolve) {
    script.onload = function() { script.remove(); resolve(); };
    script.onerror = function() { script.remove(); bridge.textContent = 'load-error'; resolve(); };
    document.body.appendChild(script);
  });
  await new Promise(function(resolve){ setTimeout(resolve, 200); });
  const result = bridge.textContent || 'timeout';
  bridge.remove();
  return result;
}

function simulateTaggleInput(tagsList) {
  const input = document.querySelector('.taggle_input');
  if (!input) return 'no_input';
  input.focus();
  for (var i = 0; i < tagsList.length; i++) {
    var tag = String(tagsList[i]).trim();
    if (!tag) continue;
    input.value = tag;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ',', keyCode: 188, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: ',', keyCode: 188, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: ',', keyCode: 188, bubbles: true }));
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return 'simulated:' + tagsList.length;
}

// Dedicated Async Auto-Paste Tags
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
  if (!isWritableInput(ta)) return { status: `Supporting tags input found but is not writable (tag=${ta.tagName}, type=${ta.type}).` };

  if (ta.classList.contains('taggle_input')) {
    const result = await writeTagsToTaggle(tagsList);
    if (!result || (!result.startsWith('ok') && !result.startsWith('simulated'))) {
      return { status: `Taggle write failed: ${result || 'unknown'}` };
    }
  } else {
    const formatted = tagsList.join(', ');
    ta.focus();
    const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(ta, formatted); else ta.value = formatted;
    ta.dispatchEvent(new Event('focus', { bubbles: true }));
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    ta.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  return { status: `🏷️ Auto-pasted ${tagsList.length} tags.` };
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
      res = await setTeePublicFields(request.item || {});
    } else if (request.action === 'TP_AUTO_PASTE_TAGS') {
      res = await autoPasteTeePublicTags(request.supporting_tags || (request.item ? request.item.supporting_tags : ''));
    } else if (request.action === 'TP_ENABLE_PRODUCTS') {
      res = await enableTeePublicProducts();
    } else if (request.action === 'TP_PUBLISH') {
      res = publishTeePublicForm(request.autoSave);
    } else if (request.action === 'TP_APPLY_ALL_FORM') {
      res = await applyAllTeePublicForm(request.item || {}, request.autoSave, request.imagePayload);
    } else if (request.action === 'TP_CLICK_UPLOAD_ART') {
      res = clickTeePublicUploadArt();
    } else if (request.action === 'TP_CLICK_UPLOAD_FILE') {
      res = await clickTeePublicUploadFile(request.imagePayload);
    } else if (request.action === 'TP_DEBUG_DUMP') {
      const els = [];
      document.querySelectorAll('textarea, input:not([type="hidden"]), [contenteditable="true"]').forEach(el => {
        els.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          name: el.name || '',
          placeholder: el.placeholder || '',
          type: el.type || '',
          'aria-label': el.getAttribute('aria-label') || '',
          className: (el.className || '').substring(0, 60),
          parentText: (el.closest('label, fieldset, [class*="tag" i], [class*="keyword" i]')?.textContent || '').substring(0, 80)
        });
      });
      console.table(els);
      res = { status: `🔍 Dumped ${els.length} form elements to console (F12 → Console tab).` };
    } else if (request.action === 'TP_DEBUG_PRODUCTS') {
      const items = [];
      document.querySelectorAll('[class*="product" i], [id*="product" i], [name*="product" i]').forEach(el => {
        items.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          name: el.name || '',
          type: el.type || '',
          className: (el.className || '').substring(0, 60),
          checked: el.checked !== undefined ? el.checked : 'n/a',
          text: (el.textContent || '').substring(0, 60)
        });
      });
      console.table(items);
      document.querySelectorAll('.product-grid, .products-table, [class*="product-list"], [class*="grid"]').forEach(el => {
        console.log('[TP_DEBUG_PRODUCTS] Container:', el.className, el.id, 'children:', el.children.length);
      });
      res = { status: `🔍 Dumped ${items.length} product elements to console.` };
    }

    sendResponse(res);
  })();

  return true; // Keep async response channel open
});
