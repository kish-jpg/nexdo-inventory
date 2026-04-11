# Google Sheets Setup Guide
## NexDo Inventory System — One-time setup (~8 minutes)

---

## What you'll end up with

- A Google Sheet that stores all your inventory data
- Anyone you share the sheet with can view (and optionally edit) directly
- The NexDo app reads and writes to that same sheet in real time
- No local database file — data is safe in Google's cloud

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and click **Blank spreadsheet**
2. Name it: **NexDo Inventory — Radisson RED**
3. Copy the Sheet ID from the URL bar:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
   ```
4. Paste it into `.env` as `GOOGLE_SHEET_ID`

---

## Step 2 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it: `nexdo-inventory` → click **Create**
4. Make sure the new project is selected

---

## Step 3 — Enable Google Sheets API

1. In the search bar, search for **Google Sheets API**
2. Click it → click **Enable**

---

## Step 4 — Create a Service Account

A service account is like a "robot user" — the app uses it to log in to Google on your behalf.

1. Go to **APIs & Services → Credentials** (left sidebar)
2. Click **+ Create Credentials → Service Account**
3. Name: `nexdo-inventory-app` → click **Create and Continue**
4. Skip the "Grant this service account access" step → click **Continue**
5. Skip the "Grant users access" step → click **Done**

---

## Step 5 — Download the Credentials Key

1. In the Credentials page, click your new service account email
2. Go to the **Keys** tab
3. Click **Add Key → Create new key → JSON** → **Create**
4. A `.json` file will download — keep it safe, don't share it publicly

---

## Step 6 — Add Credentials to .env

Open the downloaded `.json` file in a text editor. It looks like this:

```json
{
  "type": "service_account",
  "project_id": "nexdo-inventory",
  "client_email": "nexdo-inventory-app@nexdo-inventory.iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n",
  ...
}
```

Copy these two values into your `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="nexdo-inventory-app@nexdo-inventory.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

> ⚠️ **Important:** The private key must stay on one line in the .env file.
> The `\n` characters (backslash-n) represent line breaks — they should stay as `\n`, not actual newlines.
> Most credentials JSON files already have `\n` in the key — just paste it as-is inside the quotes.

---

## Step 7 — Share the Sheet with the Service Account

This is the step people often forget. The service account needs permission to edit your sheet.

1. Open your Google Sheet
2. Click the **Share** button (top right)
3. Paste the service account email (from `.env`) into the "Add people and groups" field
4. Set permission to **Editor**
5. Click **Send** (uncheck "Notify people" — it's a robot, it doesn't need emails)

---

## Step 8 — Start the App and Initialise

1. Restart the dev server: `npm run dev`
2. Open your browser and go to: `http://localhost:3000/api/init`
   - This creates the 3 sheet tabs (Items, Categories, Transactions) with headers
3. Then go to: `http://localhost:3000/api/seed`
   - This loads all 38 Radisson inventory items into the sheet

Open your Google Sheet — you should see all the data appear.

---

## Done! ✅

Your Google Sheet is now the database. Here's what each tab does:

| Tab | Contents |
|-----|----------|
| **Items** | All 38 inventory items with stock levels, par levels, status |
| **Categories** | 5 categories (Linens, Consumables, Amenities, Cleaning Supplies, Assets) |
| **Transactions** | Every stock movement (add, remove, stocktake) with timestamp |

**Who can access what:**
- Share the sheet with your team as **Viewer** to let them see stock levels
- Share as **Editor** if they should be able to update counts directly in the sheet
- The NexDo app works regardless — it reads and writes via the service account

---

## Troubleshooting

**"Google auth failed"** → Check that `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` are correct in `.env` and the server was restarted after editing.

**"Sheets GET error: 403"** → The sheet hasn't been shared with the service account. Redo Step 7.

**"Sheets GET error: 404"** → The `GOOGLE_SHEET_ID` in `.env` is wrong. Check the URL of your sheet.

**Data not showing in app** → Visit `/api/init` first, then `/api/seed`.
