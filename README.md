# GEO Tracker

Automated tracking of Development Seed's prominence across LLM-generated responses. Queries multiple AI platforms daily, analyzes responses for mentions and citations, and stores results as CSV for easy analysis.

## Overview

This tool measures how prominently Development Seed and its products appear in AI-generated answers by:

1. Querying LLMs (Perplexity, ChatGPT, Gemini, Claude) with geospatial search terms
2. Analyzing responses for mentions, citations, and recommendation language
3. Scoring prominence (0-100) based on multiple factors
4. Appending results to `data/results.csv` — committed back to the repo automatically

**Tracked queries include:**
- Development Seed products (VEDA Dashboard, titiler)
- Geospatial technologies (STAC, Cloud-Optimized GeoTIFF)
- Industry trends (Satellite Imagery, Climate Data)

## Data Output

Results are stored in `data/results.csv` with these columns:

| Column | Description |
|--------|-------------|
| `date` | Run date (YYYY-MM-DD) |
| `source` | LLM source (Perplexity, ChatGPT, Gemini, Claude) |
| `query_name` | Human-readable query name |
| `query_id` | Machine-readable query ID |
| `category` | Query category (product, technology, trend, organization) |
| `search_term` | The exact natural-language prompt sent to the LLM |
| `prominence_score` | 0-100 score based on mention position, citations, recommendations |
| `mentioned` | Whether Development Seed was mentioned |
| `recommended` | Whether DS was recommended/endorsed |
| `position` | Position of first mention (early/middle/late/none) |
| `citation_count` | Number of DS page citations found |
| `data_source` | Source type: `web` (search-grounded) or `training` (knowledge only) |
| `ds_pages` | Pipe-separated DS page URLs cited |
| `tokens` | Total tokens used for this query |

The CSV can be opened directly in Google Sheets, Excel, or loaded into any analysis tool.

## Setup

### Prerequisites

- Node.js 20 LTS
- One or more LLM API keys (see below)

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
   # Edit .env and add your API keys
   ```

4. Run the tracker:
   ```bash
   node index.js
   ```

   Results are written to `data/results.csv`.

### GitHub Actions (Automated Daily Runs)

The tracker runs automatically every day at 9:00 AM UTC via GitHub Actions. After each run, the updated CSV is committed back to the repository.

**Required Secrets:**

Configure in your repository: Settings > Secrets and variables > Actions > New repository secret

| Secret | Description | Required? |
|--------|-------------|-----------|
| `PERPLEXITY_API_KEY` | Perplexity Sonar API key | At least one |
| `OPENAI_API_KEY` | OpenAI API key (ChatGPT) | At least one |
| `GOOGLE_AI_API_KEY` | Google AI API key (Gemini) | At least one |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude) | At least one |

At least one API key must be configured for the tracker to produce results. Sources without keys are gracefully skipped.

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
│   └── geo-tracker.yml       # GitHub Actions workflow (daily run + CSV commit)
├── data/
│   └── results.csv           # Tracking results (auto-updated by CI)
├── src/
│   ├── analysis.js           # Response analysis & prominence scoring
│   ├── csv-store.js          # CSV storage module
│   ├── orchestrator.js       # Core tracking loop
│   ├── queries.js            # Query configuration
│   └── sources/
│       ├── index.js          # Source registry
│       ├── perplexity.js     # Perplexity Sonar client
│       ├── chatgpt.js        # OpenAI ChatGPT client
│       ├── gemini.js         # Google Gemini client
│       └── claude.js         # Anthropic Claude client
├── index.js                  # Main entry point
├── package.json
├── .env.example              # Environment template
└── .nvmrc                    # Node.js version (20)
```

## License

MIT
