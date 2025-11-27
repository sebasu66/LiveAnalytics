# Smart Hierarchical Sankey Node System

## Overview

This document describes the smart hierarchical node system for the Live Analytics Dashboard. The system implements a **Sankey diagram** that visualizes user journeys from traffic sources through your webshop to conversions or bounce points.

## Key Features

### 1. **Three-Level Zoom System**

The visualization adapts to show different levels of detail based on camera distance:

#### Level 1: Grouped View (Zoomed Out)
- **Distance**: > 40 units from camera
- **Display**: Traffic sources grouped by category
  - Ad Campaigns (Google Ads, Facebook Ads, etc.)
  - Social Media (Facebook, Instagram, Twitter, etc.)
  - Organic Search (Google, Bing, etc.)
  - Direct Traffic
  - Referral
  - Email
  - Other
- **Metrics**: Aggregated session counts
- **Visual**: Larger nodes, simplified labels

#### Level 2: Individual View (Medium Zoom)
- **Distance**: 20-40 units from camera
- **Display**: Individual traffic sources
  - "Google / CPC"
  - "Facebook / Social"
  - "Organic / Google"
- **Metrics**: Sessions, bounce rate
- **Visual**: Medium-sized nodes, detailed labels, animated flow particles

#### Level 3: Detailed View (Zoomed In)
- **Distance**: < 20 units from camera
- **Display**: Full detail with all metrics
- **Metrics**: Sessions, users, revenue, bounce rate, conversion rate
- **Visual**: Smaller nodes, comprehensive tooltips, all details visible

### 2. **Node Types**

The system supports different node types with distinct visual representations:

- **SOURCE_GROUP**: Grouped traffic sources (spheres, blue)
- **SOURCE**: Individual traffic sources (spheres, blue)
- **ENTRY_POINT**: Website entry points (cubes, cyan)
- **PAGE**: Individual pages (cubes, pink)
- **CHECKOUT**: Checkout steps (cylinders, gold)
- **CONVERSION**: Purchase/conversion (octahedrons, green)
- **BOUNCE**: Bounce/exit points (tetrahedrons, red)

### 3. **Hierarchical Data Structure**

```typescript
interface NodeMetadata {
    id: string;
    type: NodeType;
    label: string;
    layer: number;          // Horizontal position (0 = sources, 1 = entry, etc.)
    sessions: number;
    users?: number;
    revenue?: number;
    bounceRate?: number;
    conversionRate?: number;
    groupId?: string;       // For hierarchical grouping
    parentId?: string;      // Reference to parent node
    children?: NodeMetadata[];  // Child nodes for drill-down
}
```

### 4. **Automatic Categorization**

Traffic sources are automatically categorized based on source and medium:

```javascript
// Ad Campaigns
medium contains: cpc, ppc, paid
source contains: ads

// Social Media
medium contains: social
source contains: facebook, instagram, twitter, linkedin, tiktok, pinterest

// Organic Search
medium contains: organic
source contains: google, bing, yahoo, duckduckgo

// Referral
medium contains: referral

// Email
medium contains: email

// Direct
source: (direct), medium: (none)
```

## Architecture

### Core Classes

#### 1. **SankeyNode**
- Represents a single node in the diagram
- Handles zoom-level-specific rendering
- Manages animations (pulse, rotation, hover effects)
- Provides formatted metrics for display

#### 2. **SankeyNodeManager**
- Manages collections of nodes
- Calculates layout positions
- Handles zoom level transitions
- Provides raycasting for mouse interaction

#### 3. **FlowRenderer**
- Renders curved flow lines between nodes
- Creates animated particles along flows
- Adjusts particle density based on zoom level
- Uses cubic Bezier curves for smooth paths

### Data Flow

```
BigQuery/GA4 Data
    ↓
Backend Categorization (server.js)
    ↓
Hierarchical Structure (NodeHierarchyBuilder)
    ↓
Layout Calculation (SankeyNodeManager)
    ↓
Three.js Rendering (SankeyNode)
    ↓
User Interaction (zoom, hover, click)
```

## Usage Example

```typescript
// Initialize the system
const scene = new THREE.Scene();
const nodeManager = new SankeyNodeManager(scene);
const flowRenderer = new FlowRenderer(scene);

// Load data from backend
const response = await fetch('/api/start-historical-job', {
    method: 'POST',
    body: JSON.stringify({ propertyId, datasetId, startDate, endDate })
});
const { nodes, edges } = await response.json();

// Initialize nodes and flows
nodeManager.initializeNodes(nodes);
flowRenderer.createFlows(edges, nodeManager, ZoomLevel.GROUPED);

// Animation loop
function animate() {
    const cameraDistance = camera.position.length();
    
    // Update zoom level
    nodeManager.updateZoomLevel(cameraDistance);
    flowRenderer.updateZoomLevel(
        nodeManager.getCurrentZoomLevel(),
        edges,
        nodeManager
    );
    
    // Animate
    nodeManager.animate(deltaTime);
    flowRenderer.animate();
    
    requestAnimationFrame(animate);
}
```

## Backend Integration

The backend (`server.js`) provides hierarchical data with automatic categorization:

```javascript
// Response format
{
    status: 'completed',
    data: {
        nodes: [
            {
                id: 'source_google_cpc',
                type: 'source',
                label: 'google / cpc',
                sessions: 1500,
                layer: 0,
                groupId: 'Ad Campaigns'  // Automatic categorization
            },
            {
                id: 'page_/products',
                type: 'entry_point',
                label: '/products',
                sessions: 1200,
                layer: 1
            }
        ],
        edges: [
            {
                source: 'source_google_cpc',
                target: 'page_/products',
                value: 1000
            }
        ]
    }
}
```

## Visual Features

### Animations
- **Pulse Effect**: Nodes pulse gently to indicate activity
- **Hover Effect**: Nodes scale up and glow when hovered
- **Rotation**: Gentle rotation for visual interest
- **Flow Particles**: Animated particles travel along flow lines
- **Smooth Transitions**: All zoom level changes are smoothly animated

### Color Scheme
- **Sources**: Blue (#4facfe)
- **Entry Points**: Cyan (#00f2fe)
- **Pages**: Pink (#ff0080)
- **Checkout**: Gold (#ffd700)
- **Conversions**: Green (#00ff88)
- **Bounces**: Red (#ff4444)
- **Flow Lines**: Cyan (#00f2fe, 30% opacity)

## Next Steps

1. **Integrate with React Component**: Update `SankeyCanvas.tsx` to use the new node system
2. **Add Real-time Data**: Blend historical data with live GA4 streams
3. **Implement Drill-down**: Click nodes to drill into detailed views
4. **Add Filters**: Filter by date range, device type, geography
5. **Export Functionality**: Export visualizations as images or data

## Performance Considerations

- **Node Culling**: Only visible nodes are rendered
- **Particle Limiting**: Maximum 20 particles per flow
- **Throttled Updates**: Zoom level changes are debounced
- **Efficient Layout**: Layout calculated once, cached
- **Resource Cleanup**: Proper disposal of Three.js resources

## Troubleshooting

### Nodes not appearing
- Check that `sessions` value is > 0
- Verify `layer` property is set correctly
- Ensure camera distance is appropriate for zoom level

### Performance issues
- Reduce particle count in `FlowRenderer`
- Increase zoom level thresholds
- Limit number of visible nodes

### Incorrect grouping
- Verify `groupId` assignment in backend
- Check categorization logic in `categorizeSource()`
- Ensure `NodeHierarchyBuilder` is processing correctly
