# GEO Tracking with Node.js + Plausible

> **Note:** This document is the original high-level plan. For the detailed, authoritative specification, see `docs/prd.md` and the story files in `docs/stories/`. The example code files in this folder have been updated to reflect the PRD decisions (ES Modules, native fetch, GitHub Actions scheduling).

## Overview

Build an automated system that tracks geospatial-related search queries and logs them as custom events in Plausible using a Node.js script scheduled via GitHub Actions. This gives you visibility into what GEO-related searches are driving interest to your tools/projects.

---

## Architecture

```
┌──────────────────────────────────────┐
│   GitHub Actions (daily cron)        │
│   ┌────────────────────────────────┐ │
│   │ node index.js                  │ │
│   │                                │ │
│   │ ➜ Run GEO tracking job         │ │
│   │   - Iterate configured queries │ │
│   │   - Send events to Plausible   │ │
│   │   - Log summary & exit         │ │
│   └────────────────────────────────┘ │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   Plausible Analytics Dashboard      │
│   - Custom events tracked            │
│   - Visualize GEO queries over time  │
└──────────────────────────────────────┘
```

---

## Phase 1: Foundation (1-2 hours)

### Step 1: Set Up Your Node.js Project

Create a new folder and initialize:

```bash
mkdir geo-tracker
cd geo-tracker
npm init -y
npm install dotenv
```

Then add `"type": "module"` to your `package.json` for ES Module support. Node.js 20+ includes a built-in `fetch` API, so no HTTP library is needed.

### Step 2: Create Project Structure

```
geo-tracker/
├── .env                    # Your Plausible domain (don't commit!)
├── .gitignore             # Tell Git to ignore .env
├── package.json           # Project configuration (type: module)
├── index.js               # Main script (runs once, exits)
├── src/
│   ├── queries.js         # List of GEO queries to track
│   └── plausible.js       # Code to send events to Plausible
```

### Step 3: Create Your `.env` File

This stores your configuration safely.

```env
PLAUSIBLE_DOMAIN=yourdomain.com
```

The Plausible Events API does not require an API key for event ingestion.

**Important:** Add `.env` to `.gitignore`:

```
.env
node_modules/
.DS_Store
```

---

## Phase 2: Core Implementation (2-3 hours)

### Step 4: Create Your Query List

**File: `src/queries.js`**

Define which GEO-related searches to track. See `example_src_queries.js` for a complete example with 10 default queries across products, technologies, trends, and competitors.

### Step 5: Create Plausible Integration

**File: `src/plausible.js`**

Sends custom events to Plausible's Events API using native `fetch`. See `example_src_plausible.js` for the full implementation.

### Step 6: Create the Main Script

**File: `index.js`**

A one-shot script that validates configuration, iterates all queries, sends events, logs a summary, and exits with an appropriate code (0 for success, 1 for failure). See `example_index.js` for the full implementation.

---

## Phase 3: Add Real Data Sources (2-4 hours, depends on your data)

This is where you connect to actual GEO search data. See PRD Epic 3 stories for detailed specs.

### Option A: Google Trends API (Recommended)

Track what people are searching for on Google. Uses the `google-trends-api` package.

### Option B: GitHub Stats

Track stars, forks, and issues for your open-source repositories via the GitHub API.

### Option C: Custom Data Sources

Follow the data source convention in Story 3.3 to add your own integrations.

---

## Phase 4: Deploy via GitHub Actions (30 minutes)

### Step 7: Create GitHub Actions Workflow

Create `.github/workflows/geo-tracker.yml`:

```yaml
name: GEO Tracker
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9:00 AM UTC
  workflow_dispatch:       # Manual trigger

jobs:
  track:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: node index.js
        env:
          PLAUSIBLE_DOMAIN: ${{ secrets.PLAUSIBLE_DOMAIN }}
```

### Step 8: Configure GitHub Secrets

1. Go to your repo → Settings → Secrets and variables → Actions
2. Add `PLAUSIBLE_DOMAIN` with your Plausible domain value

### Step 9: Check Plausible Dashboard

1. Go to your Plausible dashboard
2. Look for "Goals" or "Custom Events" section
3. You should see your `GEO_Query_Tracked` events appearing
4. Add these as "Goals" in Plausible settings to visualize them

---

## Cron Expression Guide

Understanding when your GitHub Actions job runs:

```
┌─────────── minute (0 - 59)
│ ┌─────────── hour (0 - 23)
│ │ ┌─────────── day of month (1 - 31)
│ │ │ ┌─────────── month (1 - 12)
│ │ │ │ ┌─────────── day of week (0 - 6, Sunday = 0)
│ │ │ │ │
* * * * *
```

| Schedule | Cron Expression | When it runs |
|----------|-----------------|--------------|
| Daily at 9 AM | `0 9 * * *` | Every day at 9:00 AM UTC |
| Every Monday | `0 0 * * 1` | Every Monday at midnight |
| Every weekday | `0 9 * * 1-5` | Mon-Fri at 9:00 AM |
| Twice daily | `0 9,21 * * *` | 9:00 AM and 9:00 PM UTC |

Note: GitHub Actions cron has ~5-15 minute variance from the scheduled time.

Tool: Use https://crontab.guru to visualize cron expressions

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| ".env not found" | Create `.env` file in root directory |
| "Events not showing in Plausible" | Create the Goal in Plausible dashboard first |
| "Config error: Missing PLAUSIBLE_DOMAIN" | Set the env var in `.env` (local) or GitHub Secrets (CI) |
| "Too many API requests" | Increase delay between requests, reduce query count |
| GitHub Actions workflow not running | Check cron syntax, verify workflow file is on default branch |

---

## Next Steps

1. **Phase 1+2**: Get basic structure running (today)
2. **Phase 3**: Add real data sources (this week)
3. **Phase 4**: Deploy via GitHub Actions (next week)
4. **Future**:
   - Add error notifications (Slack, email)
   - Visualize trends over time
   - Create custom Plausible dashboard
   - Compare GEO interest vs. actual traffic

---

## Resources

- Plausible Events API: https://plausible.io/docs/events-api
- Node.js 20 docs: https://nodejs.org/en/docs/
- Cron syntax: https://crontab.guru
- GitHub Actions cron: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
