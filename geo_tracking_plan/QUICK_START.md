# GEO Tracker - Quick Start Guide

Get up and running in 15 minutes!

> **Note:** For the full specification, see `docs/prd.md`. This guide walks through the example code in this folder.

## Prerequisites

Make sure you have:
- Node.js 20+ installed (https://nodejs.org) - download the LTS version
- A code editor (VS Code, Sublime, etc.)
- Terminal/Command line experience (just basics!)
- A Plausible account

## Step 1: Create Project Folder (2 minutes)

Open your terminal and run:

```bash
mkdir geo-tracker
cd geo-tracker
```

## Step 2: Set Up Node Project (2 minutes)

```bash
# Initialize Node project
npm init -y

# Install the only required dependency
npm install dotenv
```

Then open `package.json` and add `"type": "module"` (see `example_package.json` for the full file).

No need to install `node-fetch` or `axios` — Node.js 20+ has a built-in `fetch` API.

## Step 3: Create Project Structure (3 minutes)

Create these folders and files:

```bash
mkdir src
touch index.js .env .gitignore src/queries.js src/plausible.js
```

Your folder should now look like:
```
geo-tracker/
├── index.js
├── .env
├── .gitignore
├── package.json
├── node_modules/
└── src/
    ├── queries.js
    └── plausible.js
```

## Step 4: Fill in Your Files (5 minutes)

### Create `.gitignore`

```
.env
node_modules/
.DS_Store
```

### Create `src/plausible.js`

Use the code from `example_src_plausible.js` provided in this folder.

### Create `src/queries.js`

Use the code from `example_src_queries.js` provided in this folder.

### Create `index.js`

Use the code from `example_index.js` provided in this folder.

### Create `.env`

Use the template from `example_env` and fill in your Plausible domain:

```
PLAUSIBLE_DOMAIN=yourdomain.com
```

Replace `yourdomain.com` with your actual Plausible domain! No API key is needed.

## Step 5: Test It! (3 minutes)

```bash
node index.js
```

You should see:

```
Configuration validated
  Domain: yourdomain.com

Starting GEO tracking job at 2026-02-05T10:30:45.123Z
Tracking 10 queries

Processing query 1/10: VEDA Dashboard
Event sent: GEO_Query_Tracked ...
...

--- Run Summary ---
Total queries:  10
Successful:     10
Failed:         0
Duration:       5.2s
Dashboard: https://plausible.io/yourdomain.com
```

If you see errors, check:
1. Is `.env` in the root folder?
2. Did you fill in `PLAUSIBLE_DOMAIN`?
3. Do you have Node.js 20+? (`node --version`)

## Step 6: Check Plausible

1. Go to https://plausible.io and log in
2. Find your dashboard
3. Look for **Goals** or **Events** section
4. You should see events coming in!

If you don't see them:
1. Create a Goal in Plausible:
   - Go to Settings -> Goals
   - Click "+ Add goal"
   - Select the custom event (e.g., `GEO_Query_Tracked`)
2. Wait a minute and refresh

## Step 7: Set Up GitHub Actions (recommended)

For automated daily runs, create `.github/workflows/geo-tracker.yml` — see Story 1.5 in `docs/stories/` or the GitHub Actions section in `GEO_TRACKING_PLAN.md` for the full workflow file.

Then add `PLAUSIBLE_DOMAIN` as a secret in your GitHub repository settings.

## Troubleshooting

### ".env not found" error

Make sure `.env` file exists in your root folder (same level as `index.js`).

### No events in Plausible dashboard

1. Check that events are being sent (look for "Event sent" in logs)
2. Create a Goal in Plausible for the event name
3. Wait 30 seconds and refresh

### Config error about PLAUSIBLE_DOMAIN

Make sure your `.env` has:
```env
PLAUSIBLE_DOMAIN=yourdomain.com
```

With your actual domain, not `yourdomain.com`!

## What's Next?

Now that the basics work:

1. **Customize queries** - Edit `src/queries.js` with your actual GEO searches
2. **Set up GitHub Actions** - Automate daily runs (see Step 7)
3. **Add real data** - Integrate Google Trends or GitHub stats (see Epic 3 stories)
4. **Add tests** - See Story 1.6 for test setup with Node.js built-in test runner

## Need Help?

- Plausible API: https://plausible.io/docs/events-api
- Node.js docs: https://nodejs.org/en/docs/
- Cron syntax: https://crontab.guru
- Full spec: `docs/prd.md`
