from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="msedge", headless=True)
    for lesson in ["0001-s01-shifted-symmetry", "0002-approaching-a-point"]:
        uri = (root / "lessons" / f"{lesson}.html").as_uri()
        for width, name in [(1280, "desktop"), (390, "mobile")]:
            page = browser.new_page(viewport={"width": width, "height": 800}, device_scale_factor=1)
            page.goto(uri)
            print(lesson, name, "fields", page.locator("textarea[data-save-key]").count(),
                  "overflow", page.evaluate("document.documentElement.scrollWidth > innerWidth"))
            page.screenshot(path=str(root / f"{lesson}-{name}-qa.png"), full_page=True)
            page.close()
    browser.close()
