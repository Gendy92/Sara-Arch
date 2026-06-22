#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import project transactions from 'Clints Sheet 12-05-2026.xlsx' into Sara Arch.
Usage:
    set SARA_USER=admin
    set SARA_PASS=admin123
    set SARA_ANON_KEY=eyJhbG...
    .venv-manual\Scripts\python import_transactions.py
"""

import os
import sys
import uuid
from datetime import date, datetime

import pandas as pd
import requests

SUPABASE_URL = "https://tvjkctttcijymqvaetsv.supabase.co"
EMAIL_DOMAIN = "gendy92.github.io"
EXCEL_FILE = "Clints Sheet 12-05-2026.xlsx"

ANON_KEY = None
TOKEN = None
TENANT_ID = None


def to_email(username):
    local = username.strip().lower().split("@")[0].replace(" ", ".")
    safe = "".join(ch for ch in local if ch.isalnum() or ch in "._-").strip(".-")
    return (safe or "user") + "@" + EMAIL_DOMAIN


def login(session, username, password):
    local = username.strip().lower().split("@")[0].replace(" ", ".")
    emails = [
        to_email(username),
        local + "@sara-arch.local",
        local.replace(".", "") + "@local",
    ]
    last_err = None
    for email in emails:
        r = session.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        if r.ok:
            data = r.json()
            print(f"Logged in with email: {email}")
            return data["access_token"], data["user"]["id"]
        last_err = r.text
    raise RuntimeError(f"Login failed for {username}: {last_err}")


def api(session, method, table, body=None, query=""):
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if TENANT_ID:
        headers["X-App-Tenant"] = TENANT_ID
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    r = session.request(method, url, headers=headers, json=body)
    if not r.ok:
        raise RuntimeError(f"{method} {url}: {r.status_code} {r.text}")
    return r.json() if r.text else []


def load_default_tenant(session, user_id):
    rows = api(
        session,
        "GET",
        "user_tenants",
        query=f"?user_id=eq.{user_id}&is_default=eq.true&select=tenant_id&limit=1",
    )
    return rows[0]["tenant_id"] if rows else None


def ensure_master_data(session, sections_items):
    # Ensure work_sections exist
    existing_sections = {s["name"].strip(): s for s in api(session, "GET", "work_sections", query="?select=id,name&deleted_at=is.null")}
    section_items_map = {}
    for section_name, item_name in sections_items:
        if not section_name:
            continue
        section_name = section_name.strip()
        item_name = item_name.strip() if item_name else ""
        if section_name not in existing_sections:
            new_section = api(session, "POST", "work_sections", {
                "id": str(uuid.uuid4()),
                "name": section_name,
                "notes": "Imported from Excel",
                "created_at": date.today().isoformat(),
                "updated_at": date.today().isoformat(),
            })[0]
            existing_sections[section_name] = new_section
            print(f"Created work section: {section_name}")
        sec_id = existing_sections[section_name]["id"]
        section_items_map.setdefault(section_name, {"id": sec_id, "items": {}})
        if item_name:
            section_items_map[section_name]["items"][item_name] = None

    # Ensure work_items exist
    all_existing_items = {i["name"].strip(): i for i in api(session, "GET", "work_items", query="?select=id,name,section_id&deleted_at=is.null")}
    for section_name, data in section_items_map.items():
        sec_id = data["id"]
        for item_name in data["items"]:
            # Item names can repeat across sections; key by (section_id, item_name)
            key = (sec_id, item_name)
            existing = next((i for i in all_existing_items.values() if i["section_id"] == sec_id and i["name"].strip() == item_name), None)
            if existing:
                data["items"][item_name] = existing["id"]
            else:
                new_item = api(session, "POST", "work_items", {
                    "id": str(uuid.uuid4()),
                    "name": item_name,
                    "section_id": sec_id,
                    "notes": "Imported from Excel",
                    "created_at": date.today().isoformat(),
                    "updated_at": date.today().isoformat(),
                })[0]
                data["items"][item_name] = new_item["id"]
                all_existing_items[item_name] = new_item
                print(f"Created work item: {item_name} ({section_name})")
    return section_items_map


def normalize_date(d):
    if pd.isna(d):
        return None
    if isinstance(d, (pd.Timestamp, datetime)):
        return d.strftime("%Y-%m-%d")
    s = str(d).strip()
    # Handle Excel strings like '010/05/2026' or '10/05/2026'
    import re
    m = re.match(r"^(\d{1,3})/(\d{1,2})/(\d{4})$", s)
    if m:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))).strftime("%Y-%m-%d")
    for fmt in ("%Y-%m-%d",):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return s[:10]


def main():
    global ANON_KEY, TOKEN, TENANT_ID
    ANON_KEY = os.environ.get("SARA_ANON_KEY")
    username = os.environ.get("SARA_USER", "")
    password = os.environ.get("SARA_PASS", "")

    if not ANON_KEY:
        print("Set SARA_ANON_KEY environment variable.")
        sys.exit(1)
    if not username or not password:
        print("Set SARA_USER and SARA_PASS environment variables.")
        sys.exit(1)

    session = requests.Session()
    token, user_id = login(session, username, password)
    TOKEN = token
    TENANT_ID = load_default_tenant(session, user_id)
    print(f"Tenant: {TENANT_ID}")

    # Load master data from Excel and ensure sections/items exist
    sections_df = pd.read_excel(EXCEL_FILE, sheet_name="الاقسام والبنود", header=None, skiprows=1)
    sections_df = sections_df.dropna(how="all")
    sections_items = []
    for _, row in sections_df.iterrows():
        section = str(row[0]).strip() if pd.notna(row[0]) else None
        item = str(row[1]).strip() if pd.notna(row[1]) else None
        if not section or section.lower() in ("القسم", "total", "المجموع", "grand total"):
            continue
        sections_items.append((section, item))
    section_items_map = ensure_master_data(session, sections_items)

    # Load clients and projects
    clients = {c["name"].strip(): c for c in api(session, "GET", "clients", query="?select=id,name&deleted_at=is.null")}
    projects_raw = api(session, "GET", "projects", query="?select=id,name,client_id,client_name&deleted_at=is.null")
    projects = {}
    for p in projects_raw:
        key = (p["name"].strip(), p.get("client_id"))
        projects[key] = p

    # Load transactions data
    df = pd.read_excel(EXCEL_FILE, sheet_name="Raw Data")
    print(f"Read {len(df)} transaction rows")

    # Fetch existing transactions to avoid duplicates
    existing_tx_keys = set()
    for t in api(session, "GET", "transactions", query="?select=type,project_id,date,amount,description&deleted_at=is.null&limit=100000"):
        key = (t.get("type"), t.get("project_id"), t.get("date"), float(t.get("amount") or 0), (t.get("description") or "").strip())
        existing_tx_keys.add(key)
    print(f"Found {len(existing_tx_keys)} existing transactions")

    skipped = 0
    inserted = 0
    batch = []
    BATCH_SIZE = 50

    for _, row in df.iterrows():
        client_name = str(row.get("العميل", "")).strip() if pd.notna(row.get("العميل")) else None
        project_name = str(row.get("المشروع", "")).strip() if pd.notna(row.get("المشروع")) else None
        tx_type_label = str(row.get("إيرادات / مصروفات", "")).strip() if pd.notna(row.get("إيرادات / مصروفات")) else None
        tx_date = normalize_date(row.get("تاريخ"))
        section_name = str(row.get("القسم", "")).strip() if pd.notna(row.get("القسم")) else None
        item_name = str(row.get("البند تفصيلي", "")).strip() if pd.notna(row.get("البند تفصيلي")) else None
        description = str(row.get("البيان", "")).strip() if pd.notna(row.get("البيان")) else ""
        expense = float(row.get("منصرف", 0) or 0)
        income = float(row.get("وارد", 0) or 0)

        if not client_name or not project_name or not tx_type_label:
            skipped += 1
            continue

        # Skip total/footer rows
        if client_name.lower() in ("grand total", "total", "المجموع", "العميل"):
            skipped += 1
            continue

        client = clients.get(client_name)
        if not client:
            print(f"Client not found: {client_name}, skipping row")
            skipped += 1
            continue

        project_key = (project_name, client["id"])
        project = projects.get(project_key)
        if not project:
            print(f"Project not found: {project_name} ({client_name}), skipping row")
            skipped += 1
            continue

        # Determine type and amount
        tx_type = None
        amount = 0.0
        if tx_type_label == "ايرادات":
            tx_type = "project_deposit"
            amount = income
        elif tx_type_label == "مصروفات":
            tx_type = "project_expense"
            amount = expense
        elif tx_type_label == "اشراف":
            tx_type = "supervision"
            amount = expense
        else:
            print(f"Unknown type '{tx_type_label}', skipping row")
            skipped += 1
            continue

        if amount <= 0:
            skipped += 1
            continue

        # Skip if already imported
        dup_key = (tx_type, project["id"], tx_date, amount, description)
        if dup_key in existing_tx_keys:
            skipped += 1
            continue

        section_id = None
        section_name_clean = None
        item_id = None
        item_name_clean = None
        expense_category = None

        if tx_type == "project_expense":
            expense_category = "construction"
            if section_name and section_name not in ("ايرادات", "نسبة الاشراف", "نسبة الاشراف10%", "نسبة الاشراف7%"):
                section_name_clean = section_name
                sec_data = section_items_map.get(section_name)
                if sec_data:
                    section_id = sec_data["id"]
                    if item_name:
                        item_name_clean = item_name
                        item_id = sec_data["items"].get(item_name)
                else:
                    # Fallback: try to find any matching section
                    for sec, data in section_items_map.items():
                        if sec == section_name:
                            section_id = data["id"]
                            item_id = data["items"].get(item_name) if item_name else None
                            break
            if section_name_clean and "تصميم" in section_name_clean:
                expense_category = "design"
            if item_name_clean and "تصميم" in item_name_clean:
                expense_category = "design"

        tx = {
            "id": str(uuid.uuid4()),
            "type": tx_type,
            "amount": amount,
            "paid_amount": amount,
            "payment_term": "immediate",
            "payment_method": "cash",
            "date": tx_date,
            "description": description or None,
            "client_id": client["id"],
            "party_id": client["id"],
            "party_name": client["name"],
            "party_type": "client",
            "project_id": project["id"],
            "project_name": project["name"],
            "vendor_id": None,
            "vendor_name": None,
            "employee_id": None,
            "employee_name": None,
            "section_id": section_id,
            "section_name": section_name_clean,
            "item_id": item_id,
            "item_name": item_name_clean,
            "expense_category": expense_category,
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
        }
        batch.append(tx)
        existing_tx_keys.add(dup_key)

        if len(batch) >= BATCH_SIZE:
            api(session, "POST", "transactions", batch)
            inserted += len(batch)
            print(f"Inserted {inserted} transactions...")
            batch = []

    if batch:
        api(session, "POST", "transactions", batch)
        inserted += len(batch)

    print(f"\nDone. Inserted {inserted} transactions, skipped {skipped} rows.")


if __name__ == "__main__":
    main()
