# Smart Sankey Visualization - Quick Start Guide

## 🎯 What You've Got

A **3-level zoom Sankey diagram** that visualizes user journeys from traffic sources through your webshop. The visualization intelligently adapts based on how zoomed in you are:

### Zoom Levels

1. **Grouped View** (Far away) - Traffic sources grouped by category
   - Ad Campaigns, Social Media, Organic Search, etc.
   
2. **Individual View** (Medium) - Individual traffic sources
   - "Google / CPC", "Facebook / Social", etc.
   
3. **Detailed View** (Close up) - Full metrics
   - Sessions, users, revenue, bounce rate, conversion rate

## 🚀 How to Use

### 1. Start Both Servers

**New!** Use the provided PowerShell scripts for one-click start/stop:

```powershell
# In project root (c:\DEV\live analytics)
.\start-project.ps1   # Starts both servers in new terminals
.\stop-project.ps1    # Kills both servers safely
```

**Manual (Legacy):**

**Terminal 1 - Backend:**
```powershell
cd "c:\DEV\live analytics"
npm start
```

**Terminal 2 - Frontend:**
```powershell
cd "c:\DEV\live analytics\client"
npm run dev
```

### 2. Open the App

Navigate to: `http://localhost:5173`

### 3. Load Your Data

**Option A: Debug Mode (Fastest)**
- If you have `debug.config.json` configured, data loads automatically
- The app will auto-select your default property and dataset

**Option B: Manual Upload**
1. Upload your GA4 service account JSON key
2. Select a GA4 property from the dropdown
3. Select a BigQuery dataset
4. Click "Load Data"

### 4. Interact with the Visualization

**Mouse Controls:**
- **Scroll** - Zoom in/out (changes zoom level automatically)
- **Click + Drag** - Rotate the view
- **Hover** - See detailed metrics for each node

**What to Look For:**
- **Blue spheres** - Traffic sources
- **Cyan cubes** - Entry points (landing pages)
- **Flowing particles** - User journeys (animated)
- **Line thickness** - Volume of traffic

## 📊 Understanding the Data

### Traffic Source Categories

The system automatically categorizes your traffic:

- **Ad Campaigns**: CPC, PPC, paid ads
- **Social Media**: Facebook, Instagram, Twitter, LinkedIn, etc.
- **Organic Search**: Google, Bing, Yahoo, etc.
- **Direct**: Direct traffic
- **Referral**: Referral traffic
- **Email**: Email campaigns
- **Other**: Everything else

### Node Colors

- 🔵 **Blue** - Traffic sources
- 🔷 **Cyan** - Entry points
- 💗 **Pink** - Pages
- 🟡 **Gold** - Checkout steps
- 🟢 **Green** - Conversions
- 🔴 **Red** - Bounces

## 🎨 Features

### Smart Zoom System
- Automatically shows/hides nodes based on zoom level
- Smooth transitions between levels
- Particle animations appear at medium/close zoom

### Interactive Tooltips
- Hover over any node to see metrics
- Metrics shown depend on zoom level
- Real-time updates

### Visual Indicators
- **Top Left**: Current zoom level
- **Top Right**: Statistics panel
- **Particles**: Animated user flows

## 🔧 Configuration

### Debug Mode Setup

Create `debug.config.json` in the root:

```json
{
  "debugMode": true,
  "autoLoadKey": true,
  "defaultKeyFile": "your-service-account-key.json",
  "defaultPropertyId": "YOUR_PROPERTY_ID",
  "defaultDataset": "analytics_XXXXXXXXX"
}
```

### Date Range

Default: Last 30 days of data

To change, modify in `App.tsx`:
```typescript
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30); // Change this number
```

## 🐛 Troubleshooting

### No nodes appearing
- Check browser console for errors
- Verify BigQuery data exists for the date range
- Ensure service account has proper permissions

### Performance issues
- Reduce date range (fewer days = less data)
- Close other browser tabs
- Check if you have hardware acceleration enabled

### Zoom not working
- Make sure you're scrolling over the canvas
- Try clicking on the canvas first to focus it
- Check that mouse events aren't being blocked

### Backend errors
- Verify `properties-config.json` exists
- Check service account key file path
- Ensure BigQuery dataset name is correct

## 📁 File Structure

```
client/src/components/
├── SankeyNode.ts          # Smart node class
├── SankeyNodeManager.ts   # Node management & flow rendering
├── SankeyCanvas.tsx       # React component
└── SankeyCanvas.css       # Styling

server.js                  # Backend with categorization logic
SANKEY_NODE_SYSTEM.md     # Detailed documentation
```

## 🎯 Next Steps

### Immediate Enhancements
1. **Add more layers**: Extend beyond entry points to show full user journey
2. **Click interactions**: Click nodes to drill down into details
3. **Filters**: Add date range picker, device filter, geography filter
4. **Export**: Save visualizations as images or videos

### Future Features
1. **Real-time data**: Blend historical with live GA4 streams
2. **Comparison mode**: Compare two time periods side-by-side
3. **Anomaly detection**: Highlight unusual patterns
4. **AI insights**: Automated analysis of user flows

## 💡 Tips

1. **Start zoomed out** to see the big picture
2. **Zoom in on interesting flows** to see details
3. **Rotate the view** to see overlapping nodes
4. **Watch the particles** to understand user flow direction
5. **Check the stats panel** for quick metrics

## 📚 Documentation

- **Architecture**: See `SANKEY_NODE_SYSTEM.md`
- **API**: See `data_contract.md`
- **Backend**: See `README_NEW_ARCHITECTURE.md`

## 🤝 Support

If you encounter issues:
1. Check the browser console for errors
2. Check the backend terminal for server errors
3. Verify your GA4/BigQuery setup
4. Review the documentation files

---

**Built with**: React + TypeScript + Three.js + Node.js + Google Analytics 4 + BigQuery

**Author**: Sebastian Urciuolo (sebastianurciuolo@gmail.com)
