#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Render app-store screenshot HTML files to 1290x2796 PNG."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

SRC_DIR = Path(r"F:\WorkBuddy\练耳大师\ios-app\app-store-pages\screenshots")
W, H = 1290, 2796


def render(html_path: Path, out_path: Path):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.goto(html_path.as_uri())
        page.wait_for_timeout(300)
        page.screenshot(path=str(out_path), clip={"x": 0, "y": 0, "width": W, "height": H})
        browser.close()
    print(f"OK -> {out_path.name}")


def main():
    names = sys.argv[1:] or sorted(SRC_DIR.glob("*.html"))
    for n in names:
        p = Path(n)
        if not p.is_absolute():
            p = SRC_DIR / p.name
        out = p.with_suffix(".png")
        render(p, out)


if __name__ == "__main__":
    main()
