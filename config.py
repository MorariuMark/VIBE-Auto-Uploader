# Auto Uploader - Central Configuration (config.py)
import os
from pathlib import Path

APP_VERSION = "1.1.3"

# Base Paths
BASE_DIR = Path(__file__).parent.resolve()
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
SAMPLE_JSON_PATH = SAMPLE_DATA_DIR / "sun_glasses_metadata.json"
SESSION_DIR = BASE_DIR / "browser_session"
STATUS_LOG_CSV = BASE_DIR / "status_log.csv"

# Redbubble URLs
REDBUBBLE_UPLOAD_URL = "https://www.redbubble.com/portfolio/images/new"
REDBUBBLE_HOME_URL = "https://www.redbubble.com"

# Brave / Chrome Binary Auto-Detection (Windows)
POSSIBLE_BROWSER_PATHS = [
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Users\%USERNAME%\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

def find_executable_browser():
    for raw_path in POSSIBLE_BROWSER_PATHS:
        expanded = os.path.expandvars(raw_path)
        if os.path.exists(expanded):
            return expanded
    return None

# Operational Pacing & Delays (Seconds)
PAGE_LOAD_TIMEOUT = 45000  # ms
SMOOTH_SCROLL_STEPS = 6
SCROLL_PAUSE_SEC = 0.15
ELEMENT_WAIT_TIMEOUT = 10000 # ms
DEFAULT_AUTO_SAVE = True
