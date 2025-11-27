# Live Analytics Dashboard

Real-time GA4 user journey visualization with e-commerce funnel analytics and multi-property support.

## Features

- **Real-time User Flow Visualization**: Animated particle system showing live user navigation
- **E-commerce Funnel Analytics**: Track product views, add-to-cart, and purchases
- **Multi-Property Support**: Switch between multiple GA4 properties with different service accounts
- **Data Verification**: Automated BigQuery and GA4 API health checks
- **Monthly Sales Dashboard**: Historical sales data with real-time enrichment
- **Modular Architecture**: SOLID principles with separate classes for each responsibility

## Tech Stack

- **Backend**: Node.js, Express, Google Analytics Data API, BigQuery API
- **Frontend**: Vanilla JavaScript (ES6 modules), Canvas API
- **Authentication**: Google Service Account (JSON key files)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure properties**:
   - Copy `properties-config.json.example` to `properties-config.json`
   - Add your GA4 property IDs and service account key files

3. **Add service account keys**:
   - Place your service account JSON key files in the project root
   - Update `properties-config.json` with the correct file names

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open browser**:
   - Navigate to `http://localhost:3000`

## Configuration

### Properties Config (`properties-config.json`)

```json
{
  "properties": [
    {
      "id": "YOUR_PROPERTY_ID",
      "name": "Your Website Name",
      "domain": "example.com",
      "bigQueryDataset": "analytics_XXXXXXXXX",
      "bigQueryProjectId": "your-project-id",
      "serviceAccountKeyFile": "your-service-account-key.json",
      "enabled": true
    }
  ]
}
```

## API Endpoints

- `GET /api/properties` - List all configured properties
- `GET /api/verify-property/:propertyId` - Complete data verification
- `GET /api/bigquery-status/:propertyId` - BigQuery availability check
- `GET /api/ga4-status/:propertyId` - GA4 API availability check
- `GET /api/realtime?propertyId=X` - Real-time user data
- `GET /api/ecommerce-funnel?propertyId=X` - E-commerce funnel data
- `GET /api/monthly-dashboard?propertyId=X` - Monthly sales dashboard

## Architecture

### Frontend Modules

- `Config.js` - Configuration constants and node definitions
- `Node.js` - Graph node rendering
- `Particle.js` - Animated user dots
- `PathRenderer.js` - E-commerce funnel path visualization
- `DataService.js` - Real-time data fetching
- `FunnelService.js` - E-commerce funnel data processing
- `MonthlyDataService.js` - Historical sales data
- `PropertyManager.js` - Multi-property switching
- `DataVerifier.js` - Data verification UI
- `MetricsTracker.js` - Monthly vs real-time metrics

### Backend

- `server.js` - Express server with all API endpoints
- Multi-auth support for different service accounts per property
- BigQuery integration for historical data
- GA4 Data API and Realtime API integration

## License

MIT

## Author

Sebastian Urciuolo (sebastianurciuolo@gmail.com)
