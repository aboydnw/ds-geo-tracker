# GEO Tracker - Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Track geospatial-related search queries and industry trends relevant to Development Seed
- Log tracking events to Plausible Analytics for visualization and analysis
- Provide visibility into what GEO-related searches are driving interest to DS tools/projects
- Operate as a low-cost, low-maintenance experiment to prove value before further investment

### Background Context
Development Seed is a small geospatial technology company (~50 people) that builds tools like VEDA Dashboard, titiler, and contributes to standards like STAC. Understanding search trends and interest in these technologies helps inform product and marketing decisions.

This project is an internal experiment to track GEO-related queries using automated jobs and visualize trends in Plausible Analytics. The MVP prioritizes simplicity and zero-cost operation using GitHub Actions.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-05 | 0.1 | Initial PRD created | PO Agent |
| 2026-02-05 | 0.2 | Updated: native fetch, added testing story, rate limits, decisions section | Reviewer |

---

## Decisions & Deviations from Original Plan

This PRD supersedes the original tutorial-style plan in `geo_tracking_plan/`. Key decisions and deviations:

| Decision | Original Plan | This PRD | Rationale |
|----------|--------------|----------|-----------|
| **Scheduling** | `node-cron` running as a long-lived process | GitHub Actions cron trigger | Zero infrastructure cost, no server to maintain, built-in logging |
| **Module system** | CommonJS (`require`/`module.exports`) | ES Modules (`import`/`export`) | Modern standard, better tooling support, native to Node 20 |
| **HTTP client** | `node-fetch` (and `axios` also listed) | Node.js 20+ native `fetch` | One fewer dependency; native fetch is stable in Node 20 LTS |
| **Dependencies** | `dotenv`, `node-fetch`, `node-cron`, `axios` | `dotenv` only | Minimal dependency footprint reduces maintenance burden |
| **Execution model** | Long-running daemon with cron scheduler | One-shot script with exit codes | Better fit for CI/CD; proper exit codes integrate with GitHub Actions |
| **Error handling** | Swallow errors to keep process alive | Fail fast with exit code 1 | CI jobs should surface failures, not hide them |
| **Deployment** | Heroku, Railway, pm2 on a server | GitHub Actions (free tier) | No paid infra for MVP; aligns with zero-cost goal |

The example code files in `geo_tracking_plan/` have been updated to reflect these decisions.

---

## Requirements

### Functional Requirements
- **FR1**: System shall send custom events to Plausible Analytics Events API for each configured GEO query
- **FR2**: System shall run on a daily schedule (once per day at a configured time)
- **FR3**: System shall support a configurable list of GEO queries with name, search terms, and category
- **FR4**: System shall log success/failure status for each tracking run
- **FR5**: System shall notify via Slack webhook when tracking jobs fail (optional, graceful degradation if not configured)
- **FR6**: System shall validate configuration on startup and fail fast with clear error messages
- **FR7**: System shall support dry-run mode for testing without sending events to Plausible
- **FR8**: System shall have basic automated tests for core modules

### Non-Functional Requirements
- **NFR1**: Must operate within GitHub Actions free tier limits (< 2000 minutes/month)
- **NFR2**: Each tracking run should complete in under 60 seconds
- **NFR3**: Must use Node.js 20 LTS for stability and long-term support
- **NFR4**: Must not require any paid infrastructure or services for MVP
- **NFR5**: Configuration must be simple enough to modify without code changes (queries in separate file)
- **NFR6**: Query list should be capped at ~50 queries for MVP to stay within Plausible rate limits (500ms delay per query = ~25 seconds for 50 queries)

---

## Technical Assumptions

### Repository Structure
Monorepo - Single repository containing all code, configuration, and GitHub Actions workflow

### Service Architecture
Serverless/Scheduled Job - GitHub Actions workflow triggers a Node.js script on a cron schedule. No persistent server required.

### Testing Requirements
- Unit tests for core functions (Plausible client, query validation, config validation)
- Uses Node.js 20+ built-in test runner (`node --test`)
- Manual testing via dry-run mode
- GitHub Actions workflow validation

### Additional Technical Assumptions
- Plain JavaScript (ES Modules) for simplicity and fast iteration
- Native `fetch` API (Node.js 20+) for HTTP requests — no `node-fetch` or `axios` needed
- `dotenv` is the sole runtime dependency
- No build step required
- Environment variables for secrets (Plausible domain, Slack webhook)
- GitHub Actions secrets for secure credential storage

---

## Epic List

### Epic 1: MVP - Core GEO Tracker
Establish the foundational GEO tracking system with daily scheduled runs via GitHub Actions, sending events to Plausible Analytics.

### Epic 2: Full Features - Enhanced Monitoring
Add operational reliability features including Slack notifications, dry-run mode, and improved error handling.

### Epic 3: Future - Data Source Integrations
Integrate real-time data sources like Google Trends, GitHub API, and custom analytics APIs to enrich tracking data.

---

## Epic 1: MVP - Core GEO Tracker

**Goal**: Deliver a working GEO tracking system that runs daily via GitHub Actions and sends events to Plausible. This establishes the foundation and proves the concept with zero infrastructure cost.

### Story 1.1: Project Foundation & Configuration
**As a** developer,
**I want** a properly structured Node.js project with all dependencies,
**so that** I have a solid foundation to build the GEO tracker.

**Acceptance Criteria:**
1. Project initialized with `package.json` targeting Node.js 20 LTS
2. `dotenv` installed as the sole runtime dependency (native `fetch` used for HTTP)
3. ES Modules configured (`"type": "module"` in package.json)
4. `.gitignore` configured to exclude `node_modules/`, `.env`, `.DS_Store`
5. `.env.example` file documents required environment variables
6. Project runs without errors: `node index.js`

---

### Story 1.2: GEO Queries Configuration
**As a** product manager,
**I want** a configurable list of GEO queries to track,
**so that** I can easily add, remove, or modify queries without code changes.

**Acceptance Criteria:**
1. `src/queries.js` exports an array of query objects
2. Each query has: `id` (string), `name` (string), `searchTerms` (array), `category` (string)
3. Default queries include: VEDA Dashboard, titiler, STAC, COG, Satellite Imagery, Climate Data, Development Seed
4. File is well-documented with comments explaining the structure
5. Queries can be imported and iterated in main script
6. `searchTerms` are documented as metadata in MVP, included in event props for reference; they become actively queried in Epic 3 data source integrations

---

### Story 1.3: Plausible Analytics Integration
**As a** developer,
**I want** a module that sends custom events to Plausible,
**so that** tracking data appears in our analytics dashboard.

**Acceptance Criteria:**
1. `src/plausible.js` exports `sendEventToPlausible(eventName, props)` function
2. Function sends POST request to `https://plausible.io/api/event` using native `fetch`
3. Payload includes: `name`, `url`, `domain`, `props`
4. Function returns `true` on success (HTTP 202), `false` on failure
5. Errors are caught and logged, not thrown (graceful failure)
6. Domain is read from `PLAUSIBLE_DOMAIN` environment variable
7. Function validates that required env vars exist before sending

---

### Story 1.4: Main Tracking Script
**As a** developer,
**I want** a main script that processes all queries and sends events,
**so that** the tracker can run as a scheduled job.

**Acceptance Criteria:**
1. `index.js` loads environment variables via dotenv
2. Script iterates through all GEO queries and sends events to Plausible
3. Each event includes: `query_id`, `query_name`, `category`, `timestamp`
4. Script logs start time, progress, and completion summary
5. Script exits with code 0 on success, code 1 on critical failure
6. 500ms delay between API calls to avoid rate limiting
7. Script can be run manually: `node index.js`

---

### Story 1.5: GitHub Actions Workflow
**As a** developer,
**I want** a GitHub Actions workflow that runs the tracker daily,
**so that** tracking happens automatically without manual intervention.

**Acceptance Criteria:**
1. `.github/workflows/geo-tracker.yml` workflow file created
2. Workflow runs on schedule: daily at 9:00 AM UTC (`cron: '0 9 * * *'`)
3. Workflow can be triggered manually via `workflow_dispatch`
4. Workflow uses Node.js 20 LTS
5. Workflow installs dependencies and runs `node index.js`
6. `PLAUSIBLE_DOMAIN` passed as environment variable from GitHub secrets
7. Workflow logs are visible in GitHub Actions tab

---

### Story 1.6: Basic Test Setup
**As a** developer,
**I want** automated tests for core modules,
**so that** I can catch regressions and validate behavior without manual testing.

**Acceptance Criteria:**
1. Uses Node.js 20+ built-in test runner (`node --test`) — no test framework dependency needed
2. `src/plausible.test.js` tests the `sendEventToPlausible` function with a mocked `fetch`
3. `src/queries.test.js` validates query array structure (all required fields present, no duplicate IDs)
4. Tests can be run via `npm test`
5. Tests pass in CI (GitHub Actions workflow runs tests before tracking)

---

## Epic 2: Full Features - Enhanced Monitoring

**Goal**: Add operational reliability features that make the tracker production-ready with failure notifications, testing capabilities, and improved observability.

### Story 2.1: Configuration Validation
**As a** developer,
**I want** startup validation of all required configuration,
**so that** misconfiguration is caught immediately with helpful error messages.

**Acceptance Criteria:**
1. `src/config.js` exports `validateConfig()` function
2. Validates `PLAUSIBLE_DOMAIN` is set and non-empty
3. Validates `PLAUSIBLE_DOMAIN` is a valid domain format
4. Logs clear error message identifying which variable is missing/invalid
5. Returns validation result object with `valid` boolean and `errors` array
6. Main script calls `validateConfig()` on startup and exits if invalid

---

### Story 2.2: Dry-Run Mode
**As a** developer,
**I want** a dry-run mode that logs what would be sent without calling Plausible,
**so that** I can test the tracker safely.

**Acceptance Criteria:**
1. `DRY_RUN=true` environment variable enables dry-run mode
2. In dry-run mode, `sendEventToPlausible` logs payload but doesn't make HTTP request
3. Logs clearly indicate "[DRY-RUN]" prefix when in this mode
4. Summary shows "X events would be sent" instead of "X events sent"
5. Dry-run mode can be triggered in GitHub Actions via input parameter

---

### Story 2.3: Slack Failure Notifications
**As an** operations team member,
**I want** Slack notifications when the tracking job fails,
**so that** I'm alerted to issues without checking GitHub Actions manually.

**Acceptance Criteria:**
1. `src/slack.js` exports `sendSlackNotification(message, isError)` function
2. Function sends POST to `SLACK_WEBHOOK_URL` if configured
3. If `SLACK_WEBHOOK_URL` is not set, function silently skips (graceful degradation)
4. Message includes: job status, error details (if any), timestamp, link to GitHub run
5. Main script sends notification on failure (any unhandled error or critical failure)
6. Notifications use appropriate emoji: checkmark for success, X for failure

---

### Story 2.4: Enhanced Logging & Summary
**As a** developer,
**I want** structured logging with a clear run summary,
**so that** I can quickly understand what happened in each run.

**Acceptance Criteria:**
1. Each log line includes ISO timestamp prefix
2. Run summary includes: total queries, successful events, failed events, duration
3. Failed events are listed with query name and error reason
4. Log output is clean and parseable (no excessive emoji in production)
5. `LOG_LEVEL` environment variable controls verbosity (info, debug)

---

## Epic 3: Future - Data Source Integrations

**Goal**: Enhance tracking with real data from external sources to provide actionable insights beyond simple event logging.

### Story 3.1: Google Trends Integration
**As a** product manager,
**I want** to track Google Trends interest levels for GEO queries,
**so that** I can see actual search volume trends over time.

**Acceptance Criteria:**
1. Optional `google-trends-api` integration
2. For each query, fetch 7-day interest data from Google Trends
3. Include `interest_value` in Plausible event props
4. Gracefully skip if Google Trends API fails (still send basic event)
5. Rate limit requests to avoid Google blocking

---

### Story 3.2: GitHub Stats Integration
**As a** developer advocate,
**I want** to track GitHub repository statistics for DS projects,
**so that** I can correlate search interest with actual project engagement.

**Acceptance Criteria:**
1. Optional GitHub API integration for configured repositories
2. Track: stars, forks, open issues for each repo
3. Send separate `GEO_GitHub_Stats` event type
4. Use `GITHUB_TOKEN` for authenticated requests (higher rate limits)
5. Gracefully skip if GitHub API fails

---

### Story 3.3: Data Source Convention
**As a** developer,
**I want** a consistent pattern for adding data sources,
**so that** new integrations follow a predictable structure.

**Acceptance Criteria:**
1. Data sources live in `src/sources/` directory
2. Each source exports a standard interface: `{ name, enabled, fetchData }`
3. Sources are explicitly imported in `src/sources/index.js` (no dynamic filesystem discovery)
4. Sources can be enabled/disabled via environment variables
5. Failed sources don't block other sources from running

---

## Next Steps

### Architect Prompt
Create the technical architecture for the GEO Tracker based on this PRD. Focus on:
- Node.js 20 LTS project structure with ES Modules
- GitHub Actions workflow design
- Plausible API integration using native `fetch`
- Error handling, exit codes, and logging standards
- Security (secrets management via GitHub Actions secrets)
- Basic test setup using Node.js built-in test runner

Use the PRD at `docs/prd.md` as your primary input.
