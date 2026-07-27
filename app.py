# Paladium Redbubble Auto Uploader - Streamlit Desktop GUI (app.py)
import os
import sys
import time
import pandas as pd
import streamlit as st
from pathlib import Path

# Local imports
from config import BASE_DIR, SAMPLE_DATA_DIR, SAMPLE_JSON_PATH, SESSION_DIR, STATUS_LOG_CSV, APP_VERSION
from validator import CSVValidator
from session_manager import BrowserSessionManager
from uploader import RedbubbleUploader

st.set_page_config(
    page_title=f"Auto Uploader v{APP_VERSION}",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Dark Theme & Aesthetics)
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%);
        padding: 18px 24px;
        border-radius: 12px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
    }
    .main-header h1 {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 0.5px;
    }
    .main-header p {
        margin: 4px 0 0 0;
        opacity: 0.9;
        font-size: 13px;
    }
    .metric-card {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
    }
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

# Header Section
st.markdown(f"""
<div class="main-header">
    <h1>🎨 Auto Uploader v{APP_VERSION}</h1>
    <p>Automated Batch Asset Uploading & Form Automation Companion Engine • JSON (Default) & CSV Supported</p>
</div>
""", unsafe_allow_html=True)

# Sidebar Configuration
st.sidebar.title("⚙️ Engine Controls")

default_dataset = str(SAMPLE_JSON_PATH)
default_images = str(SAMPLE_DATA_DIR)

csv_path = st.sidebar.text_input("Metadata File Path (.json Default / .csv)", value=default_dataset)
images_dir = st.sidebar.text_input("PNG Images Directory Path", value=default_images)

auto_save = st.sidebar.checkbox("Auto Save Work (#submit-work)", value=True, help="If unchecked, pauses on form completion for manual review.")
filename_agnostic = st.sidebar.checkbox("Filename Agnostic Mode (Ignore PNG Name)", value=False, help="If checked, ignores exact image filename matching in JSON/CSV and attaches any selected PNG image.")
headless_mode = st.sidebar.checkbox("Run Browser Headless", value=False, help="Uncheck to view live browser automation.")

st.sidebar.divider()
st.sidebar.caption("System Status: Ready")

# Tabs Definition
tab_batch, tab_script, tab_session, tab_validator = st.tabs([
    "🚀 Batch Auto Uploader",
    "⚡ Instant Console Script Generator",
    "🔒 Browser Session Manager",
    "📊 Pre-Flight CSV Validator"
])

# ==========================================
# TAB 1: BATCH AUTO UPLOADER
# ==========================================
with tab_batch:
    st.subheader("🚀 Automated Batch Processing")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        if st.button("🚀 Start Automated Batch Upload", type="primary", use_container_width=True):
            if not os.path.exists(csv_path):
                st.error(f"Specified CSV path does not exist: {csv_path}")
            elif not os.path.exists(images_dir):
                st.error(f"Specified Images directory does not exist: {images_dir}")
            else:
                st.info("Initiating Playwright orchestration engine...")
                uploader = RedbubbleUploader(
                    csv_path=csv_path,
                    image_dir=images_dir,
                    auto_save=auto_save,
                    headless=headless_mode
                )
                uploader.run_batch()
                st.success("Batch execution completed!")

    with col2:
        if st.button("🔄 Refresh Status Logs", use_container_width=True):
            st.rerun()

    st.divider()
    st.subheader("📊 Live Status Log CSV")
    
    if STATUS_LOG_CSV.exists():
        log_df = pd.read_csv(STATUS_LOG_CSV)
        st.dataframe(log_df, use_container_width=True)
    else:
        st.info("No status log created yet. Start a batch to generate status_log.csv.")

# ==========================================
# TAB 2: INSTANT CONSOLE SCRIPT GENERATOR
# ==========================================
with tab_script:
    st.subheader("⚡ Instant F12 Console Script Generator")
    st.caption("Select any row in your CSV dataset to generate standalone JavaScript code you can copy and paste directly into browser F12 Console.")

    if os.path.exists(csv_path) and os.path.exists(images_dir):
        validator = CSVValidator(csv_path, images_dir)
        val_res = validator.validate()
        
        if val_res['data']:
            df_rows = pd.DataFrame(val_res['data'])
            selected_idx = st.selectbox("Select Design Row:", options=df_rows.index, format_func=lambda x: f"Row {df_rows.loc[x, 'row_num']}: {df_rows.loc[x, 'title']} ({df_rows.loc[x, 'image_filename']})")
            
            selected_row = df_rows.loc[selected_idx]
            
            # Generate JavaScript Snippet
            js_code = f"""/* Auto Uploader 1.0 - Instant Console Snippet for Row #{selected_row['row_num']} */
(async function() {{
    console.log("%c[Auto Uploader 1.0 Console Script] Executing for '{selected_row['title']}'...", "color: #ec4899; font-weight: bold;");
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function setField(selectors, value) {{
        if (!value) return false;
        for (let sel of selectors) {{
            const elems = document.querySelectorAll(sel);
            for (let elem of elems) {{
                if (!elem) continue;
                if (elem.isContentEditable || elem.getAttribute('contenteditable') === 'true' || elem.getAttribute('role') === 'textbox') {{
                    elem.focus();
                    elem.innerText = value;
                    elem.textContent = value;
                    elem.dispatchEvent(new Event('focus', {{ bubbles: true }}));
                    elem.dispatchEvent(new InputEvent('input', {{ bubbles: true, cancelable: true, inputType: 'insertText', data: value }}));
                    elem.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    elem.dispatchEvent(new Event('blur', {{ bubbles: true }}));
                    return true;
                }}
                if (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA') {{
                    const proto = elem.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                    const valueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                    if (valueSetter) valueSetter.call(elem, value);
                    else elem.value = value;
                    elem.dispatchEvent(new Event('focus', {{ bubbles: true }}));
                    elem.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    elem.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    elem.dispatchEvent(new Event('blur', {{ bubbles: true }}));
                    return true;
                }}
            }}
        }}
        return false;
    }}

    // 1. Title
    setField(['#work_title_en', 'input[name="work[title_en]"]', 'input[id^="work_title"]', '#work_title', 'input[placeholder*="Title" i]'], {repr(selected_row['title'])});

    // 2. Main Tag
    setField(['#main-tag-en', 'span[id*="main-tag"]', '[id*="main-tag"]', '#work_tag_editor_en', '#work_tag', '#work_tag_field', 'input[placeholder*="Main tag" i]'], {repr(selected_row['main_tag'])});
    setField(['#work_tag_editor_en', 'input[name="work[tag_field_en]"]'], {repr(selected_row['main_tag'])});

    // 3. Supporting Tags
    setField(['#supporting-tags-en', 'span[id*="supporting-tags"]', '[id*="supporting-tags"]', '#work_tag_list', 'textarea[name="work[tag_list]"]', 'textarea[id*="supporting"]'], {repr(selected_row['supporting_tags'])});

    // 4. Description
    setField(['#work_description_en', 'textarea[name="work[description_en]"]', 'textarea[id^="work_description"]', '#work_description'], {repr(selected_row['description'])});

    // 5. Background Color HEX
    setField(['#work_bg_color', 'input[name="work[bg_color]"]', 'input[type="color"]', '.background-color-global'], {repr(selected_row['background_color'])});

    // 6. Multi-Pass Smooth Scrolling & Product Category Enablement
    const totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 4000);
    for (let y = 0; y < totalHeight; y += 350) {{
        window.scrollTo(0, y);
        await sleep(40);
    }}
    window.scrollTo(0, 0);
    await sleep(200);

    function forceClick(elem) {{
        if (!elem) return;
        try {{
            elem.focus?.();
            elem.dispatchEvent(new MouseEvent('mousedown', {{ bubbles: true, cancelable: true, view: window }}));
            elem.dispatchEvent(new Event('focus', {{ bubbles: true }}));
            elem.dispatchEvent(new MouseEvent('mouseup', {{ bubbles: true, cancelable: true, view: window }}));
            elem.click();
            elem.dispatchEvent(new MouseEvent('click', {{ bubbles: true, cancelable: true, view: window }}));
        }} catch (e) {{}}
    }}

    document.querySelectorAll('input[type="checkbox"][name*="product"], input[type="checkbox"][id*="product"]').forEach(cb => {{
        if (!cb.checked) forceClick(cb);
    }});

    document.querySelectorAll('button, a, div[role="button"], span[role="button"], label').forEach(elem => {{
        const txt = (elem.textContent || '').trim().toLowerCase();
        const dataState = elem.getAttribute('data-state');
        const ariaChecked = elem.getAttribute('aria-checked');
        const className = (elem.className || '').toString().toLowerCase();

        const isDisabledText = (txt.includes('disabled') && !txt.includes('enabled')) || txt === 'off' || txt === '+ disabled' || txt.includes('enable product');
        const isDisabledState = dataState === 'off' || dataState === 'disabled' || ariaChecked === 'false' || className.includes('disabled');
        const isAlreadyEnabled = txt.includes('enabled') && !txt.includes('disabled');

        if ((isDisabledText || isDisabledState) && !isAlreadyEnabled) {{
            forceClick(elem);
        }}
    }});

    // 7. Media Options
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {{
        const parent = (cb.parentElement?.textContent || '').toLowerCase();
        if ((parent.includes('design') || parent.includes('digital')) && !cb.checked) cb.click();
    }});

    // 8. Public, Safe, Agreement
    document.querySelector('#work_public_true, input[name="work[public]"][value="true"]')?.click();
    document.querySelector('#work_safe_for_work_true, input[name="work[safe_for_work]"][value="true"]')?.click();
    
    const rights = document.querySelector('#rightsDeclaration, input[name="rightsDeclaration"]');
    if (rights && !rights.checked) rights.click();

    console.log("%c[Paladium Console Script] Completed successfully!", "color: #10b981; font-weight: bold;");
}})();"""

            st.code(js_code, language="javascript")
        else:
            st.warning("No valid CSV rows loaded.")
    else:
        st.error("Please provide valid CSV path and Images directory path in sidebar.")

# ==========================================
# TAB 3: BROWSER SESSION MANAGER
# ==========================================
with tab_session:
    st.subheader("🔒 Browser Session & Persistent Cookie Manager")
    st.caption("Launch an interactive browser session to log in to Redbubble manually. Your session cookies will be saved in `./browser_session/`.")

    sm = BrowserSessionManager(SESSION_DIR)
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🌐 Launch Interactive Browser for Manual Login", use_container_width=True):
            st.info("Browser window opening... Complete login and close window when done.")
            sm.launch_interactive_login()
            st.success("Session saved!")
            
    with col2:
        if st.button("🔍 Check Current Login Status", use_container_width=True):
            with st.spinner("Checking session credentials..."):
                logged_in = sm.check_login_status()
                if logged_in:
                    st.success("✅ Redbubble Session Active & Logged In!")
                else:
                    st.warning("⚠️ Session not logged in. Please launch interactive browser to log in.")

# ==========================================
# TAB 4: PRE-FLIGHT CSV VALIDATOR
# ==========================================
with tab_validator:
    st.subheader("📊 Pre-Flight CSV & Asset Validator")
    
    if os.path.exists(csv_path) and os.path.exists(images_dir):
        validator = CSVValidator(csv_path, images_dir)
        res = validator.validate()
        
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Rows", res['total_rows'])
        c2.metric("Valid Rows", res['valid_rows_count'])
        c3.metric("Errors", res['error_count'])
        c4.metric("Warnings", res['warning_count'])
        
        st.divider()

        if res['errors']:
            st.error("❌ Validation Errors Found:")
            for err in res['errors']:
                st.write(f"- {err}")

        if res['warnings']:
            st.warning("⚠️ Validation Warnings:")
            for warn in res['warnings']:
                st.write(f"- {warn}")

        if res['data']:
            st.subheader("Validated Dataset Preview")
            st.dataframe(pd.DataFrame(res['data']), use_container_width=True)
    else:
        st.error("Invalid CSV or Images Directory path provided in sidebar.")
