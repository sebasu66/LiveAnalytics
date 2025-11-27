# Migration Plan: Navigation Visualizer

This document outlines the steps to migrate the current Vanilla JS + Express application to the proposed React + Node.js architecture, following the user's design document.

## Current State
- **Backend**: Express server (`server.js`) with basic property management and on-demand data fetching.
- **Frontend**: Vanilla JS (`js/`) with Canvas 2D visualization.
- **Data**: Direct calls to GA4/BigQuery on request.

## Target State
- **Backend**: Enhanced Express server with Job Queue, Caching (Redis/Memory), and WebSocket/SSE.
- **Frontend**: React (Vite) + Three.js/PixiJS application.
- **Data**: Historical batch jobs + Live polling (5 min) + AI Analysis.

## Migration Phases

### Phase 0: Preparation
- [x] Create `migration_plan.md`
- [x] Create `data_contract.md` (JSON schemas)
- [ ] Define Service Account scopes

### Phase 1: Infra & Auth (Backend)
- [x] Implement `POST /api/upload-key`
- [x] Implement `POST /api/validate-key` (or part of upload)
- [x] Implement `detect_ga4_properties` and `detect_bq_datasets`
- [x] Securely handle temporary keys (Memory/Encrypted File)

### Phase 2: Historical Pipeline (Backend)
- [x] Create `JobQueue` (in-memory or Redis)
- [x] Implement `POST /api/start-historical-job`
- [x] Implement BigQuery query builder for `paths_monthly_agg`
- [x] Create `GET /api/historical-paths` endpoint (integrated in job endpoint)

### Phase 3: Frontend Scaffold (React)
- [ ] Initialize Vite React app in `client/` directory
- [ ] Setup Proxy to backend
- [ ] Port `Config.js` and basic constants
- [ ] Setup Three.js/Pixi.js canvas

### Phase 4: Live Data & Particles
- [ ] Implement `LivePollWorker` (Backend)
- [ ] Implement WebSocket/SSE endpoint
- [ ] Create Particle System in React/Three.js

### Phase 5: LOD & Details
- [ ] Implement Zoom logic in Frontend
- [ ] Create `GET /api/node-details` endpoint

### Phase 6: AI Analyst
- [ ] Implement `AIWorker` (Backend)
- [ ] Create `GET /api/insights` and SSE events
