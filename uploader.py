# Paladium Redbubble Auto Uploader - Playwright Engine (uploader.py)
import os
import time
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError
from config import SESSION_DIR, STATUS_LOG_CSV, REDBUBBLE_UPLOAD_URL, find_executable_browser
from validator import CSVValidator

class RedbubbleUploader:
    def __init__(self, csv_path: str, image_dir: str, auto_save: bool = True, headless: bool = False, filename_agnostic: bool = False, callback=None):
        self.csv_path = Path(csv_path)
        self.image_dir = Path(image_dir)
        self.auto_save = auto_save
        self.headless = headless
        self.filename_agnostic = filename_agnostic
        self.callback = callback
        self.browser_path = find_executable_browser()
        self.log_file = STATUS_LOG_CSV
        self._init_status_log()

    def _init_status_log(self):
        if not self.log_file.exists():
            df = pd.DataFrame(columns=['timestamp', 'image_filename', 'title', 'status', 'details'])
            df.to_csv(self.log_file, index=False)

    def _log_status(self, image_filename: str, title: str, status: str, details: str = ""):
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        df = pd.read_csv(self.log_file)
        # Idempotent update: update existing row or append
        existing = df[df['image_filename'] == image_filename]
        if not existing.empty:
            df.loc[df['image_filename'] == image_filename, ['timestamp', 'status', 'details']] = [timestamp, status, details]
        else:
            new_row = pd.DataFrame([{
                'timestamp': timestamp,
                'image_filename': image_filename,
                'title': title,
                'status': status,
                'details': details
            }])
            df = pd.concat([df, new_row], ignore_index=True)
        df.to_csv(self.log_file, index=False)

        if self.callback:
            self.callback(image_filename, title, status, details)

    def is_already_processed(self, image_filename: str) -> bool:
        if not self.log_file.exists():
            return False
        df = pd.read_csv(self.log_file)
        match = df[(df['image_filename'] == image_filename) & (df['status'] == 'SUCCESS')]
        return not match.empty

    def run_batch(self):
        validator = CSVValidator(str(self.csv_path), str(self.image_dir))
        val_result = validator.validate()

        if not val_result['is_valid']:
            print(f"[Uploader] CSV Validation Failed: {val_result['error_count']} errors found.")
            return val_result

        items = val_result['data']
        print(f"[Uploader] Starting batch process for {len(items)} items...")

        launch_args = {
            "user_data_dir": str(SESSION_DIR),
            "headless": self.headless,
            "viewport": {"width": 1280, "height": 900},
            "args": ["--no-sandbox", "--disable-setuid-sandbox"]
        }
        if self.browser_path:
            launch_args["executable_path"] = self.browser_path

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(**launch_args)
            page = context.new_page()

            for item in items:
                img_name = item['image_filename']
                title = item['title']

                if self.is_already_processed(img_name):
                    print(f"[Uploader] Skipping {img_name} - Already processed (SUCCESS).")
                    self._log_status(img_name, title, 'SKIPPED', 'Already uploaded')
                    continue

                try:
                    self._log_status(img_name, title, 'PROCESSING', 'Navigating to upload page...')
                    self._process_single_design(page, item)
                    status = 'SUCCESS' if self.auto_save else 'PAUSED'
                    details = 'Uploaded & Saved automatically' if self.auto_save else 'Form filled, paused for manual review'
                    self._log_status(img_name, title, status, details)
                except Exception as e:
                    print(f"[Uploader] Error processing {img_name}: {e}")
                    self._log_status(img_name, title, 'FAILED', str(e))

            context.close()

    def _fill_generic_field(self, page: Page, selectors: list, value: str):
        if not value:
            return
        for sel in selectors:
            try:
                elem = page.query_selector(sel)
                if elem:
                    is_editable = page.evaluate("(el) => el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox'", elem)
                    if is_editable:
                        page.evaluate("(args) => { const [el, val] = args; el.focus(); el.innerText = val; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); }", [elem, value])
                        return
                    else:
                        page.fill(sel, value)
                        page.dispatch_event(sel, 'input')
                        page.dispatch_event(sel, 'change')
                        page.dispatch_event(sel, 'blur')
                        return
            except Exception:
                continue

    def _process_single_design(self, page: Page, item: dict):
        # 1. Navigate to Redbubble Upload Page
        page.goto(REDBUBBLE_UPLOAD_URL, timeout=45000)
        page.wait_for_load_state("domcontentloaded")
        time.sleep(2)

        # 2. Attach Image File
        img_path = self.image_dir / item.get('image_filename', '')
        if (not img_path.exists() or not item.get('image_filename')) and self.filename_agnostic:
            available_pngs = list(self.image_dir.glob("*.png"))
            if available_pngs:
                img_path = available_pngs[0]
                print(f"[Uploader] Filename Agnostic Mode: using '{img_path.name}' for listing '{item.get('title')}'")

        file_input_selector = 'input[type="file"], #select-image-single, input[accept*="image"]'
        page.wait_for_selector(file_input_selector, timeout=15000)
        page.set_input_files(file_input_selector, str(img_path))
        time.sleep(2)

        # 3. Fill Title
        self._fill_generic_field(page, [
            '#work_title_en', 'input[name="work[title_en]"]', 'input[id^="work_title"]',
            '#work_title', 'input[name="work[title]"]', 'input[placeholder*="Title" i]'
        ], item['title'])

        # 4. Fill Main Tag
        main_tag = item.get('main_tag', '')
        self._fill_generic_field(page, [
            '#main-tag-en', 'span[id*="main-tag"]', '[id*="main-tag"]',
            '#work_tag_editor_en', 'input[name="work[tag_field_en]"]',
            '#work_tag', '#work_tag_field', 'input[name="work[tag]"]'
        ], main_tag)

        # 5. Fill Supporting Tags
        supporting = item.get('supporting_tags', '')
        self._fill_generic_field(page, [
            '#supporting-tags-en', 'span[id*="supporting-tags"]', '[id*="supporting-tags"]',
            '#work_tag_list', 'textarea[name="work[tag_list]"]', 'textarea[id*="supporting"]'
        ], supporting)

        # 6. Fill Description
        self._fill_generic_field(page, [
            '#work_description_en', 'textarea[name="work[description_en]"]', 'textarea[id^="work_description"]',
            '#work_description', 'textarea[name="work[description]"]', 'textarea[placeholder*="description" i]'
        ], item.get('description', ''))

        # 7. Fill Background HEX Color
        hex_color = item.get('background_color', '')
        if hex_color and not hex_color.startswith('#'): hex_color = '#' + hex_color
        self._fill_generic_field(page, [
            '#work_bg_color', 'input[name="work[bg_color]"]', 'input[type="color"]',
            '.background-color-global', 'input[placeholder*="#" i]'
        ], hex_color)

        # 8. Page-Wide Multi-Pass Smooth Scrolling & Enable Product Category Cards
        page.evaluate("""() => {
            const totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 4000);
            for (let y = 0; y < totalHeight; y += 350) {
                window.scrollTo(0, y);
            }
            window.scrollTo(0, 0);
        }""")
        time.sleep(1)

        # Enable product cards via multi-strategy JS evaluate
        page.evaluate("""() => {
            function forceClick(elem) {
                if (!elem) return;
                try {
                    elem.focus?.();
                    elem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    elem.dispatchEvent(new Event('focus', { bubbles: true }));
                    elem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    elem.click();
                    elem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } catch (e) {}
            }

            // Strategy 0: Direct Redbubble Native Category Enable Buttons (.enable-all)
            document.querySelectorAll('.enable-all, div.enable-all, .rb-button.enable-all, [class*="enable-all"]').forEach(btn => {
                const txt = (btn.textContent || '').trim().toLowerCase();
                if (!txt.includes('disable-all') && !btn.className.includes('disable-all')) {
                    forceClick(btn);
                }
            });

            // Strategy A: Checkboxes
            document.querySelectorAll('input[type="checkbox"][name*="product"], input[type="checkbox"][id*="product"], input[type="checkbox"][name*="enabled"]').forEach(cb => {
                if (!cb.checked) forceClick(cb);
            });

            // Strategy B: Buttons & Toggles
            document.querySelectorAll('button, a, div[role="button"], span[role="button"], label, div[class*="toggle"], div.rb-button').forEach(elem => {
                const txt = (elem.textContent || '').trim().toLowerCase();
                const dataState = elem.getAttribute('data-state');
                const ariaChecked = elem.getAttribute('aria-checked');
                const className = (elem.className || '').toString().toLowerCase();

                const isAlreadyEnabled = (txt.includes('enabled') && !txt.includes('disabled')) || dataState === 'on' || ariaChecked === 'true' || className.includes('disable-all');
                const isDisabledText = txt.includes('disabled') || txt === 'off' || txt === '+ disabled' || txt.includes('enable');
                const isDisabledState = dataState === 'off' || dataState === 'disabled' || ariaChecked === 'false' || (className.includes('disabled') && !className.includes('enabled'));

                if ((isDisabledText || isDisabledState) && !isAlreadyEnabled) {
                    forceClick(elem);
                }
            });
        }""")
        time.sleep(1)

        # 9. Media Options (Design & Digital Art)
        page.evaluate("""() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                const val = (cb.value || '').toLowerCase();
                const parentText = (cb.parentElement?.textContent || '').toLowerCase();
                if ((val.includes('design') || val.includes('digital') || parentText.includes('design') || parentText.includes('digital')) && !cb.checked) {
                    cb.click();
                }
            });
        }""")

        # 10. Default Product: Optimized
        default_prod_selector = '#work_default_product, select[name="work[default_product]"]'
        if page.is_visible(default_prod_selector):
            try:
                page.select_option(default_prod_selector, label='Optimized (recommended)')
            except Exception:
                try:
                    page.select_option(default_prod_selector, index=0)
                except Exception:
                    pass

        # 11. Public Visibility
        public_selector = '#work_public_true, input[name="work[public]"][value="true"]'
        if page.is_visible(public_selector):
            page.click(public_selector)

        # 12. Mature Content: NO
        safe_selector = '#work_safe_for_work_true, input[name="work[safe_for_work]"][value="true"]'
        if page.is_visible(safe_selector):
            page.click(safe_selector)

        # 13. Tick Rights Agreement
        rights_selector = '#rightsDeclaration, input[name="rightsDeclaration"]'
        if page.is_visible(rights_selector):
            if not page.is_checked(rights_selector):
                page.check(rights_selector)

        # 14. Save Work Control
        if self.auto_save:
            submit_selector = '#submit-work, button#submit-work, input[type="submit"]'
            page.wait_for_selector(submit_selector, timeout=10000)
            page.click(submit_selector)
            time.sleep(4)

if __name__ == "__main__":
    from config import SAMPLE_DATA_DIR
    uploader = RedbubbleUploader(
        csv_path=str(SAMPLE_DATA_DIR / "matrix_panda_metadata.csv"),
        image_dir=str(SAMPLE_DATA_DIR),
        auto_save=False,
        headless=False
    )
    print("RedbubbleUploader initialized.")
