// Auto Uploader v1.0.7 - content.js

console.log("%c[Auto Uploader v1.0.7] Content script loaded.", "color: #ec4899; font-weight: bold;");

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

// Message Listener from Popup or Background Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    let res = { status: "Invalid action" };

    if (request.action === 'SET_FIELD') {
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
    }

    sendResponse(res);
  })();

  return true; // Keep async response channel open
});
