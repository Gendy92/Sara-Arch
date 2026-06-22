#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import clients and projects from 'Clints Sheet 12-05-2026.xlsx' into Sara Arch.
Usage:
    set SARA_USER=admin
    set SARA_PASS=admin123
    set SARA_ANON_KEY=eyJhbG...
    .venv-manual\Scripts\python import_clients_projects.py
"""

import os
import sys
import uuid
from datetime import date

import pandas as pd
import requests

SUPABASE_URL = "https://tvjkctttcijymqvaetsv.supabase.co"
EMAIL_DOMAIN = "gendy92.github.io"
EXCEL_FILE = "Clints Sheet 12-05-2026.xlsx"
SHEET_NAME = "العملاء و المشاريع"

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

    # Read Excel sheet (skip the two header rows)
    df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME, header=None, skiprows=2)
    df = df.dropna(how="all")
    print(f"Read {len(df)} rows from '{SHEET_NAME}'")

    # Login
    session = requests.Session()
    token, user_id = login(session, username, password)
    TOKEN = token
    TENANT_ID = load_default_tenant(session, user_id)
    print(f"Logged in as {username}. Tenant: {TENANT_ID}")

    # Fetch existing clients and projects to avoid duplicates
    existing_clients = {c["name"].strip(): c for c in api(session, "GET", "clients", query="?select=id,name&deleted_at=is.null")}
    existing_projects = {(p["name"].strip(), p.get("client_id")): p for p in api(session, "GET", "projects", query="?select=id,name,client_id&deleted_at=is.null")}

    created_clients = 0
    created_projects = 0

    for _, row in df.iterrows():
        client_name = str(row[0]).strip() if pd.notna(row[0]) else None
        project_name = str(row[1]).strip() if pd.notna(row[1]) else None
        if not client_name or not project_name:
            continue
        # Skip totals / footer rows
        if client_name.lower() in ("grand total", "total", "المجموع"):
            continue

        # Create or reuse client
        if client_name in existing_clients:
            client = existing_clients[client_name]
            print(f"Client exists: {client_name}")
        else:
            client = api(session, "POST", "clients", {
                "id": str(uuid.uuid4()),
                "name": client_name,
                "phone": None,
                "email": None,
                "address": None,
                "notes": "Imported from Excel",
                "created_at": date.today().isoformat(),
                "updated_at": date.today().isoformat(),
            })[0]
            existing_clients[client_name] = client
            created_clients += 1
            print(f"Created client: {client_name}")

        # Create project if not exists for this client
        key = (project_name, client["id"])
        if key in existing_projects:
            print(f"  Project exists: {project_name}")
            continue

        api(session, "POST", "projects", {
            "id": str(uuid.uuid4()),
            "name": project_name,
            "client_id": client["id"],
            "client_name": client_name,
            "value": 0,
            "supervision_percentage": 0,
            "status": "active",
            "start_date": None,
            "end_date": None,
            "notes": "Imported from Excel",
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
        })[0]
        existing_projects[key] = True
        created_projects += 1
        print(f"  Created project: {project_name}")

    print(f"\nDone. Created {created_clients} clients and {created_projects} projects.")


if __name__ == "__main__":
    main()
