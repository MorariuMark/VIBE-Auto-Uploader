# Paladium Redbubble Auto Uploader - Session Manager (session_manager.py)
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from config import SESSION_DIR, find_executable_browser, REDBUBBLE_HOME_URL, REDBUBBLE_UPLOAD_URL

class BrowserSessionManager:
    def __init__(self, session_dir: Path = SESSION_DIR):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.browser_path = find_executable_browser()

    def launch_interactive_login(self):
        """Launches a headful browser context for manual user login & CAPTCHA completion."""
        print(f"[SessionManager] Launching browser session from: {self.session_dir}")
        with sync_playwright() as p:
            launch_args = {
                "user_data_dir": str(self.session_dir),
                "headless": False,
                "viewport": {"width": 1280, "height": 900},
                "args": ["--no-sandbox", "--disable-setuid-sandbox"]
            }

            if self.browser_path:
                print(f"[SessionManager] Using detected browser binary: {self.browser_path}")
                launch_args["executable_path"] = self.browser_path

            context = p.chromium.launch_persistent_context(**launch_args)
            page = context.new_page()
            page.goto(REDBUBBLE_HOME_URL)

            print("[SessionManager] Browser opened. Please log into Redbubble if not logged in.")
            print("[SessionManager] Keep browser open until login is completed. Close window when finished.")
            
            # Wait until user closes the page or browser
            try:
                while len(context.pages) > 0:
                    time.sleep(1)
            except Exception:
                pass
            print("[SessionManager] Session saved successfully.")

    def check_login_status(self) -> bool:
        """Navigates to upload URL and checks if redirected to login page."""
        with sync_playwright() as p:
            launch_args = {
                "user_data_dir": str(self.session_dir),
                "headless": True,
                "args": ["--no-sandbox"]
            }
            if self.browser_path:
                launch_args["executable_path"] = self.browser_path

            try:
                context = p.chromium.launch_persistent_context(**launch_args)
                page = context.new_page()
                page.goto(REDBUBBLE_UPLOAD_URL, timeout=20000)
                time.sleep(2)
                current_url = page.url
                context.close()

                is_logged_in = "login" not in current_url.lower() and "portfolio/images/new" in current_url.lower()
                return is_logged_in
            except Exception as e:
                print(f"[SessionManager] Check login error: {e}")
                return False

if __name__ == "__main__":
    sm = BrowserSessionManager()
    print("Checking login status...")
    status = sm.check_login_status()
    print(f"Logged in: {status}")
