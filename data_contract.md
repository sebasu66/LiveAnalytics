# Data Contract

## 1. Auth & Config
### `POST /api/upload-key`
**Request:** `multipart/form-data` (file: `key.json`)
**Response:**
```json
{
  "status": "ok",
  "token": "temporary_auth_token",
  "projectId": "gcp-project-id",
  "properties": [
    { "id": "123456", "name": "My Shop", "default": true }
  ],
  "datasets": [
    { "id": "analytics_123456", "location": "US" }
  ]
}
```

## 2. Historical Data
### `GET /api/historical-paths`
**Response:**
```json
{
  "nodes": [
    { "id": "source_google", "type": "source", "label": "Google", "metrics": { "sessions": 1500, "revenue": 0 } },
    { "id": "landing_home", "type": "landing", "label": "Home", "metrics": { "sessions": 1200, "bounceRate": 0.4 } }
  ],
  "edges": [
    { "source": "source_google", "target": "landing_home", "value": 1000, "metrics": { "conversion": 0.1 } }
  ]
}
```

## 3. Live Data
### `WS /socket` or `SSE /api/live-stream`
**Event: `live_update`**
```json
{
  "timestamp": "2023-10-27T10:00:00Z",
  "activeUsers": 125,
  "sampleSessions": [
    { "id": "sess_1", "path": ["source_google", "landing_home", "product_A"], "currentStep": 2, "velocity": 1.5 }
  ],
  "nodeUpdates": {
    "landing_home": { "active": 15 }
  }
}
```

## 4. AI Insights
### `GET /api/insights`
**Response:**
```json
[
  {
    "id": "ins_1",
    "type": "anomaly",
    "severity": "high",
    "title": "Checkout Drop-off Spike",
    "description": "Checkout abandonment increased by 25% in the last hour.",
    "timestamp": "2023-10-27T10:05:00Z",
    "relatedNodes": ["checkout_step_1"]
  }
]
```
