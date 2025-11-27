


# Navigation Flow Visualizer - New React Architecture

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud Service Account JSON Key with:
  - BigQuery Data Viewer
  - BigQuery Job User
  - Google Analytics Viewer

### Running the Application

1. **Start the Backend** (Terminal 1):
```bash
npm start
# Runs on http://localhost:3000
```

2. **Start the Frontend** (Terminal 2):
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

3. **Open Browser**: Navigate to `http://localhost:5173`

## 📁 Project Structure

```
live analytics/
├── server.js                 # Express backend with GA4/BigQuery integration
├── client/                   # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── KeyUpload.tsx        # Service Account upload UI
│   │   │   ├── PropertySelector.tsx # GA4 property selection
│   │   │   └── SankeyCanvas.tsx     # Three.js visualization
│   │   ├── App.tsx           # Main app with workflow orchestration
│   │   └── main.tsx
│   └── vite.config.ts        # Proxy configuration
├── js/                       # Legacy Vanilla JS (still functional)
├── migration_plan.md         # Step-by-step migration guide
└── data_contract.md          # API schemas
```

## 🔄 Application Flow

### Step 1: Upload Service Account Key
- User uploads JSON key file
- Backend validates and detects:
  - Available BigQuery datasets
  - Accessible GA4 properties
- Returns temporary token (1-hour TTL)

### Step 2: Select Data Source
- User selects GA4 property
- User selects BigQuery dataset
- Frontend triggers historical data job

### Step 3: Visualization
- Backend queries BigQuery for last 30 days
- Transforms data into graph format (nodes + edges)
- Frontend renders with Three.js particles
- Real-time stats overlay

## 🔌 API Endpoints

### `POST /api/upload-key`
Upload and validate Service Account JSON key.

**Request**: `multipart/form-data` with `keyFile`

**Response**:
```json
{
  "status": "ok",
  "token": "abc123...",
  "projectId": "my-project",
  "bqDatasets": [...],
  "ga4Properties": [...]
}
```

### `POST /api/start-historical-job`
Fetch historical navigation data from BigQuery.

**Request**:
```json
{
  "token": "abc123...",
  "propertyId": "123456",
  "startDate": "2025-10-27",
  "endDate": "2025-11-26"
}
```

**Response**:
```json
{
  "status": "completed",
  "data": {
    "nodes": [...],
    "edges": [...]
  }
}
```

## 🎨 Tech Stack

### Backend
- **Express.js** - REST API
- **Google Cloud SDK** - BigQuery & GA4 APIs
- **Multer** - File upload handling
- **Crypto** - Token generation

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Three.js** - WebGL 3D visualization
- **Axios** - HTTP client

## 🔐 Security

- Service Account keys stored in **memory only** (never on disk)
- Temporary tokens expire after **1 hour**
- Keys encrypted with Node.js `crypto` module
- CORS enabled for localhost development

## 📊 Data Flow

```
User → Upload Key → Backend validates → Detect resources
                                      ↓
User → Select Property/Dataset → Backend queries BigQuery
                                      ↓
                            Transform to graph format
                                      ↓
                            Frontend renders with Three.js
```

## 🚧 Migration Status

✅ **Phase 0**: Preparation (migration plan, data contracts)  
✅ **Phase 1**: Auth & Infra (upload-key endpoint)  
✅ **Phase 3**: Frontend Scaffold (React + Vite)  
✅ **Phase 2 (Partial)**: Historical pipeline (basic BigQuery query)  
⏳ **Phase 4**: Live data polling (5-min intervals)  
⏳ **Phase 5**: LOD/Zoom & node details  
⏳ **Phase 6**: AI analyst module  

## 🔮 Next Steps

1. **Enhance BigQuery Queries**: Build complete path analysis (acquisition → landing → product → checkout)
2. **Live Polling Worker**: Implement 5-minute GA4 Realtime polling
3. **WebSocket/SSE**: Stream live updates to frontend
4. **Particle Animation**: Animate particles along paths
5. **LOD System**: Multi-resolution node rendering on zoom
6. **AI Insights**: Anomaly detection and automated analysis

## 🐛 Troubleshooting

**Port 3000 already in use?**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

**Frontend can't reach backend?**
- Check `client/vite.config.ts` proxy is set to `http://localhost:3000`
- Ensure both servers are running

**BigQuery errors?**
- Verify Service Account has correct permissions
- Check dataset naming convention: `analytics_<propertyId>`
- Ensure GA4 → BigQuery export is configured

## 📝 Legacy vs New

| Feature | Legacy (Vanilla JS) | New (React) |
|---------|-------------------|-------------|
| **UI** | Canvas 2D | Three.js WebGL |
| **Auth** | Static config file | Dynamic key upload |
| **Data** | Hardcoded property | Multi-property support |
| **State** | Global variables | React hooks |
| **Build** | None | Vite (HMR) |

Both versions are functional and can run simultaneously!
