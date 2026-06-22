#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Capture live screenshots of Sara Arch app using Playwright."""

import asyncio
import os
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

URL = os.environ.get("SARA_URL", "https://gendy92.github.io/Sara-Arch/index.html")
USERNAME = os.environ.get("SARA_USER", "")
PASSWORD = os.environ.get("SARA_PASS", "")
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUTDIR = Path(__file__).parent / "screenshots"

SHOTS = [
    ("login", None, "شاشة تسجيل الدخول"),
    ("dashboard", "App.go('dashboard')", "لوحة التحكم"),
    ("clients", "App.go('clients')", "شاشة العملاء والمشاريع"),
    ("transactions", "App.go('transactions')", "شاشة معاملات المشاريع"),
    ("office", "App.go('office')", "حساب المكتب"),
    ("vendors", "App.go('vendors')", "شاشة الموردين"),
    ("employees", "App.go('employees')", "شاشة الموظفين"),
    ("tasks", "App.go('tasks')", "شاشة المهام"),
    ("settings", "App.go('settings')", "شاشة الإعدادات"),
    ("backup", "App.go('backup')", "شاشة النسخ الاحتياطي والاستعادة"),
    ("master", "App.go('master')", "البيانات الأساسية"),
]


def wait_for_no_skeleton(page):
    return page.wait_for_function(
        """() => {
          const skeletons = document.querySelectorAll('.skeleton');
          return skeletons.length === 0;
        }""",
        timeout=30000
    )


async def main():
    if OUTDIR.exists():
        shutil.rmtree(OUTDIR)
    OUTDIR.mkdir(parents=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=EDGE_PATH,
            headless=True
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("Loading app...")
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_selector('input[name="username"]', timeout=30000)
        await page.screenshot(path=str(OUTDIR / "login.png"), full_page=True)
        print("Captured login.png")

        print("Logging in...")
        await page.fill('input[name="username"]', USERNAME)
        await page.fill('input[name="password"]', PASSWORD)
        await page.click('form[data-form="login"] button')

        # Wait for dashboard to load
        await page.wait_for_selector('.kpi-card', timeout=30000)
        await asyncio.sleep(2)

        for filename, js, caption in SHOTS[1:]:
            print(f"Capturing {filename}...")
            try:
                await page.evaluate(js)
                await asyncio.sleep(1.5)
                await wait_for_no_skeleton(page)
                await asyncio.sleep(0.5)
                path = OUTDIR / f"{filename}.png"
                await page.screenshot(path=str(path), full_page=True)
                print(f"  -> {path}")
            except Exception as e:
                print(f"  ERROR capturing {filename}: {e}")

        # Try to capture a client detail if any client exists
        try:
            await page.evaluate("App.go('clients')")
            await wait_for_no_skeleton(page)
            await asyncio.sleep(0.5)
            links = await page.query_selector_all("a[href='#']")
            for link in links:
                onclick = await link.get_attribute("onclick") or ""
                if "App.go('project'" in onclick or "App.go('client'" in onclick:
                    await link.click()
                    await wait_for_no_skeleton(page)
                    await asyncio.sleep(1)
                    await page.screenshot(path=str(OUTDIR / "project_detail.png"), full_page=True)
                    print("Captured project_detail.png")
                    break
        except Exception as e:
            print(f"Could not capture project detail: {e}")

        # Capture common modals
        MODALS = [
            ("modal_add_client", "Crud.addClient()", "نموذج إضافة عميل"),
            ("modal_add_project", "Crud.addProject()", "نموذج إضافة مشروع"),
            ("modal_project_expense", "Crud.addProjectExpense()", "نموذج مصروف مشروع"),
            ("modal_office_income", "Crud.addOfficeIncome()", "نموذج إيراد مكتبي"),
            ("modal_office_custody", "Crud.addOfficeCustody()", "نموذج إضافة عهدة نقدية"),
            ("modal_procurement", "Crud.addProcurement()", "نموذج مشتريات"),
        ]
        for filename, js, caption in MODALS:
            print(f"Capturing modal {filename}...")
            try:
                # ensure we are on a screen where modal can open
                await page.evaluate("App.go('clients')")
                await wait_for_no_skeleton(page)
                await asyncio.sleep(0.3)
                await page.evaluate(js)
                await asyncio.sleep(1.2)
                await page.screenshot(path=str(OUTDIR / f"{filename}.png"), full_page=True)
                print(f"  -> {filename}.png")
                # close modal by clicking backdrop or Escape
                await page.keyboard.press("Escape")
                await asyncio.sleep(0.3)
            except Exception as e:
                print(f"  ERROR {filename}: {e}")

        await browser.close()

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
