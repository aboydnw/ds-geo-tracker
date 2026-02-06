# GEO Tracker

Automated tracking of geospatial-related search queries, logging events to [Plausible Analytics](https://plausible.io).

## Overview

This tool tracks interest in GEO-related technologies and products by sending custom events to Plausible Analytics on a daily schedule via GitHub Actions.

**Tracked queries include:**
- Development Seed products (VEDA Dashboard, titiler)
- Geospatial technologies (STAC, Cloud-Optimized GeoTIFF)
- Industry trends (Satellite Imagery, Climate Data)

## Setup

### Prerequisites

- Node.js 20 LTS
- A [Plausible Analytics](https://plausible.io) account with your domain configured

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/aboydnw/ds-geo-tracker.git
   cd ds-geo-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env and set PLAUSIBLE_DOMAIN=yourdomain.com
   ```

4. Run the tracker:
   ```bash
   node index.js
   ```

### GitHub Actions (Automated Daily Runs)

The tracker runs automatically every day at 9:00 AM UTC via GitHub Actions.

**Required Secret:**

Configure in your repository: Settings → Secrets and variables → Actions → New repository secret

| Secret | Description | Example |
|--------|-------------|---------|
| `PLAUSIBLE_DOMAIN` | Your Plausible domain | `developmentseed.org` |

**Manual Trigger:**

1. Go to the Actions tab in your repository
2. Select "GEO Tracker" workflow
3. Click "Run workflow"

## Configuration

### Adding/Modifying Queries

Edit `src/queries.js` to add or modify tracked queries:

```javascript
{
  id: 'my-query',
  name: 'My Query Name',
  searchTerms: ['search term 1', 'search term 2'],
  category: 'product', // product | technology | trend | organization
}
```

### Schedule

The default schedule is daily at 9:00 AM UTC. To change it, edit the cron expression in `.github/workflows/geo-tracker.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'  # Daily at 9 AM UTC
```

Use [crontab.guru](https://crontab.guru) to build cron expressions.

## Project Structure

```
geo-tracker/
├── .github/workflows/
│   └── geo-tracker.yml    # GitHub Actions workflow
├── src/
│   ├── plausible.js       # Plausible API client
│   └── queries.js         # Query configuration
├── index.js               # Main entry point
├── package.json
├── .env.example           # Environment template
└── .nvmrc                 # Node.js version
```

## License

MIT
