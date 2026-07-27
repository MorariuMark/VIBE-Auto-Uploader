# 🎨 Auto Uploader v1.1.2 - Redbubble Automation Suite

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Playwright](https://img.shields.io/badge/Engine-Playwright-violet.svg)](https://playwright.dev/)
[![Streamlit](https://img.shields.io/badge/GUI-Streamlit-red.svg)](https://streamlit.io/)

**Auto Uploader** is a dual-engine automated asset uploading and form automation system built specifically for creators, digital artists, and print-on-demand store owners selling designs on Redbubble.

It eliminates tedious manual upload tasks by automatically populating titles, primary/supporting tags, descriptions, HEX background colors, attaching design PNG images, enabling all 29 product category cards, selecting media types, declaring public visibility and mature content settings, and accepting seller agreements automatically.

---

## ✨ Dual-Engine Architecture

### 1. 🧩 Chrome / Brave Browser Extension (v1.1.2 - Manifest V3)
- **Zero Cloudflare / Bot Checks**: Operates directly inside your logged-in browser tab.
- **JSON (Default) & CSV Data Sources**: Load batch datasets via `.json` files, raw JSON paste text, or secondary `.csv` files.
- **Filename Agnostic Mode (Optional)**: Ignore PNG filename matching in datasets to upload any selected PNG design image seamlessly.
- **Smart React Contenteditable Handler**: Solves React synthetic event registration for contenteditable tag spans (`#main-tag-en`, `#supporting-tags-en`).
- **Connection Recovery**: Auto-injects content scripts into active tabs when reloaded.

### 2. 🐍 Streamlit + Playwright Desktop Engine
- **Full Python Desktop GUI**: Interactive web dashboard (`app.py`).
- **Playwright Browser Automation**: Headless or headful browser control with persistent session cookies (`session_manager.py`).
- **Console Script Generator**: Generates standalone JavaScript bookmarklets for quick browser execution.

---

## 📐 Data Architecture Schema

### JSON Schema Architecture (`sample_data/schema.json`)
The application uses JSON array objects as its primary data format:

```json
[
  {
    "image_filename": "sun glasses.png",
    "title": "Cool Day Animated - Dragon Sunglasses Sun Graphic",
    "main_tag": "cool day sun",
    "supporting_tags": [
      "dragon sunglasses",
      "animated sun",
      "cool day",
      "mascot logo",
      "summer vibes",
      "solar flames",
      "sticker design"
    ],
    "description": "A vibrant graphic design featuring a smiling animated sun wearing dark sunglasses styled with green dragon horns.",
    "background_color": "#0b192e",
    "is_mature": "No",
    "is_public": "Public",
    "enable_all_products": "Yes"
  }
]
```

---

## 🚀 Quick Start Guide

### Option A: Installing the Chrome / Brave Extension
1. Open your browser and navigate to `chrome://extensions` or `brave://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `extension` folder from this repository.
4. Pin **Auto Uploader v1.1.2** to your browser toolbar.
5. Open a Redbubble upload tab (`https://www.redbubble.com/portfolio/images/new`), open the extension popup, select your JSON/CSV metadata file and PNG design images, then click **`⚡ Apply ALL Form & Product Options Now`** or **`🚀 Start Auto`**!

---

### Option B: Running the Streamlit Desktop Companion
1. Clone this repository and navigate into the root directory:
   ```bash
   git clone https://github.com/MorariuMark/Auto-Uploader.git
   cd Auto-Uploader
   ```
2. Set up the virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   playwright install chromium
   ```
3. Launch the desktop GUI:
   ```bash
   streamlit run app.py
   ```
   *(Or double-click `run_app.bat` on Windows)*.

---

## 📂 Repository Structure

```
Auto-Uploader/
├── extension/                 # Chrome / Brave Browser Extension (Manifest V3)
│   ├── manifest.json          # Extension Manifest v1.1.2
│   ├── popup.html             # Extension Popup UI
│   ├── popup.js               # Popup Logic & JSON/CSV Parser
│   ├── content.js             # DOM Automation & React Event Injector
│   └── background.js          # Service Worker Batch Orchestrator
├── sample_data/               # Sample Datasets & Reference Files
│   ├── schema.json            # JSON Schema Definition
│   ├── sun_glasses_metadata.json # Example JSON Dataset
│   └── cool_day_dragon_sun_metadata.csv # Example CSV Dataset
├── app.py                     # Streamlit Desktop Dashboard
├── uploader.py                # Playwright Automation Engine
├── validator.py               # Pre-Flight Dataset & Image Asset Validator
├── session_manager.py         # Browser Session & Cookie Persistence
├── config.py                  # Central System Configuration
├── load_extension.bat         # Extension Loader Helper Script
├── run_app.bat                # Streamlit Launcher Script
├── requirements.txt           # Python Package Dependencies
└── README.md                  # System Documentation
```

---

## 🛠️ Requirements & Technical Specifications

- **Browser**: Google Chrome or Brave Browser (Manifest V3 support).
- **Python Environment**: Python 3.10+ with `streamlit`, `playwright`, `pandas`, `Pillow`.
- **Target Site**: Redbubble Portfolio Image Upload Interface (`/portfolio/images/new`).

---

## 📄 License
This project is developed for personal and automated POD workflow enhancement. Distributed under the MIT License.
