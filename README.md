# Auto Uploader v1.3.0 — Redbubble & TeePublic Automation Suite

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

A Chrome/Brave browser extension that automates the full design upload workflow for **Redbubble** and **TeePublic** — eliminating tedious manual form-filling, product enabling, and publishing.

---

## Features

- **Dual-Platform**: Supports both Redbubble (`/portfolio/images/new`) and TeePublic (`/teepublic.com/designs/*/edit`)
- **Batch Loop**: Automatically fills forms, publishes, clicks "Upload Art", uploads the next image, and repeats until the folder is done
- **Automatic Field Population**: Title, main tag, supporting tags (including Taggle widget API), description, background color, mature content, terms
- **Product Toggle Engine**: Enables all OFF product categories and sets default color swatches + white background (TeePublic)
- **Image Upload**: Attaches design images via DataTransfer API (no file dialog)
- **JSON & CSV Input**: Metadata via JSON, raw JSON paste, or CSV
- **Filename Agnostic Mode**: Skip PNG filename matching, attach any available image
- **Humanized Delays**: Random 1-8s pauses between actions to evade anti-bot detection
- **On-Screen HUD**: Visual feedback overlay during automation
- **Pause/Stop/Restart**: Full batch control with persistent progress

---

## Quick Start

1. Open `chrome://extensions` or `brave://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `extension` folder
4. Pin **Auto Uploader v1.3.0** to the toolbar
5. Navigate to your platform's upload/edit page, open the popup, load a folder (or JSON/CSV), and click **Start Auto**

### Redbubble Flow

1. Extension fills fields, ticks products, sets public/mature/terms
2. Publishes (`#submit-work`), waits 12s, clicks "Add another design", then "Upload new work"
3. Attaches next image and loops back

### TeePublic Flow

1. Extension attaches image, fills fields (title, tags, description, mature NO, terms)
2. Enables all OFF product categories, sets default colors, white background
3. Random 3-8s delay, then clicks **Publish & Promote**
4. Waits 10s for publish confirmation, clicks **Upload Art** button
5. Waits 5s for upload page, attaches next image via `#design_primary_image_file`
6. Loops to next item

---

## Data Schema

```json
[
  {
    "image_filename": "cool_day_dragon_sun.png",
    "title": "Cool Day Animated - Dragon Sunglasses Sun Graphic",
    "main_tag": "cool day sun",
    "supporting_tags": [
      "dragon sunglasses",
      "animated sun",
      "sticker design"
    ],
    "description": "A vibrant graphic design featuring a smiling animated sun wearing dark sunglasses.",
    "background_color": "#0b192e",
    "is_mature": "No",
    "is_public": "Public",
    "enable_all_products": "Yes"
  }
]
```

---

## Repository Structure

```
Auto-Uploader/
├── extension/                     # Chrome/Brave Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest v1.3.0
│   ├── popup.html                 # Popup UI (Redbubble + TeePublic tabs)
│   ├── popup.js                   # Popup logic, file parsing, batch controls
│   ├── content.js                 # DOM automation: form fill, products, image, publish, loop
│   ├── background.js              # Service worker: batch orchestrator, loop, IndexedDB
│   ├── tp_enable_products.js      # Page-context script: product toggles, colors, bg
│   └── tp_taggle_api.js           # Page-context script: Taggle widget tag insertion
├── sample_data/                   # Sample datasets
│   ├── schema.json                # JSON schema definition
│   └── *.json / *.csv             # Example datasets
├── app.py                         # (Legacy) Streamlit dashboard
├── uploader.py                    # (Legacy) Playwright engine
├── validator.py                   # (Legacy) Dataset validator
├── session_manager.py             # (Legacy) Browser session manager
├── config.py                      # (Legacy) Configuration
└── README.md                      # This file
```

---

## Toggles

| Toggle | Description |
|---|---|
| **Auto Publish / Save** | Whether to auto-publish after filling the form |
| **Upload Loop** | After publish, continue to next item in the batch |
| **Filename Agnostic** | Ignore filename matching, use any available image |
| **Humanized Delays** | Random 1-8s pauses between actions |

---

## Requirements

- Google Chrome or Brave Browser (Manifest V3)
- Active logged-in session on Redbubble or TeePublic
- No additional Python/Node dependencies needed for the extension

---

## License

Distributed under the MIT License.
