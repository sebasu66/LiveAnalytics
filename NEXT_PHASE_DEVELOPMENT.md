# Siguiente Fase de Desarrollo - Live Analytics Dashboard

## Estado Actual del Proyecto

### ✅ Completado
- Sistema de autenticación con Service Account Keys
- Debug mode con auto-login
- Visualización básica con diagrama de Sankey
- Agrupación de páginas en categorías genéricas (HOME, CATALOGO, CART, CHECKOUT, etc.)
- Panel lateral con información jerárquica por nodo
- Datos demográficos (edad, género, dispositivo, ubicación)
- Integración con BigQuery y GA4 Data API
- Multi-property support
- Nombre de propiedad en header

### 🚧 Pendiente (según README.md)
- Partículas de tráfico vivo animadas
- Barra de progreso de actualización
- Sistema de caching (5 minutos)
- IA Analyst con insights automáticos
- Optimización de layout para datasets grandes

---

## FASE 3: Visualización Avanzada y Datos Enriquecidos

### Objetivo
Mejorar la visualización y agregar información contextual específica para cada tipo de nodo, haciendo el sistema más útil y accionable.

---

## 3.1. Información Jerárquica por Tipo de Nodo

### HOME (Página de Inicio)
**Datos a mostrar en el panel lateral:**

```javascript
{
  "nodeType": "HOME",
  "sessions": 15234,
  "bounceRate": "45.2%",
  "avgTimeOnPage": "2:34",
  "topSearchTerms": [
    { "term": "zapatillas running", "count": 234 },
    { "term": "new balance 574", "count": 189 },
    { "term": "ofertas", "count": 156 }
  ],
  "topNextPages": [
    { "page": "CATALOGO", "sessions": 8234, "percentage": "54%" },
    { "page": "BUSQUEDA", "sessions": 3421, "percentage": "22%" },
    { "page": "PROMOCION", "sessions": 2156, "percentage": "14%" }
  ],
  "deviceBreakdown": {
    "mobile": "68%",
    "desktop": "28%",
    "tablet": "4%"
  }
}
```

**Query necesaria (GA4 Data API):**
```javascript
// En ga4Service.js
async getHomePageData(auth, propertyId, dateRanges) {
  const searches = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    dateRanges,
    dimensions: [{ name: 'searchTerm' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'view_search_results' }
      }
    },
    limit: 10
  });
  
  return {
    topSearchTerms: searches.data.rows.map(r => ({
      term: r.dimensionValues[0].value,
      count: parseInt(r.metricValues[0].value)
    }))
  };
}
```

---

### CATALOGO (Páginas de Productos)
**Datos a mostrar:**

```javascript
{
  "nodeType": "CATALOGO",
  "sessions": 23456,
  "topProducts": [
    {
      "name": "New Balance 574 Classic",
      "views": 1234,
      "addToCart": 456,
      "conversionRate": "37%",
      "revenue": "$12,345"
    },
    {
      "name": "Fresh Foam 1080v12",
      "views": 987,
      "addToCart": 321,
      "conversionRate": "32.5%",
      "revenue": "$8,765"
    }
  ],
  "productsViewedNotAdded": [
    { "name": "990v5", "views": 543, "addToCartRate": "12%" },
    { "name": "327", "views": 432, "addToCartRate": "15%" }
  ],
  "avgProductsPerSession": 3.2,
  "categoryBreakdown": {
    "Running": "45%",
    "Lifestyle": "32%",
    "Training": "23%"
  }
}
```

**Query necesaria:**
```javascript
// Combinar eventos de GA4
async getCatalogData(auth, propertyId, dateRanges) {
  // 1. Product views
  const views = await runReport({
    dimensions: [{ name: 'itemName' }],
    metrics: [{ name: 'itemsViewed' }],
    dimensionFilter: { eventName: 'view_item' }
  });
  
  // 2. Add to cart
  const addToCart = await runReport({
    dimensions: [{ name: 'itemName' }],
    metrics: [{ name: 'itemsAddedToCart' }],
    dimensionFilter: { eventName: 'add_to_cart' }
  });
  
  // 3. Purchases
  const purchases = await runReport({
    dimensions: [{ name: 'itemName' }],
    metrics: [{ name: 'itemRevenue' }],
    dimensionFilter: { eventName: 'purchase' }
  });
  
  // Combinar y calcular conversion rates
  return mergeProductData(views, addToCart, purchases);
}
```

---

### CART (Carrito)
**Datos a mostrar:**

```javascript
{
  "nodeType": "CART",
  "sessions": 5678,
  "abandonmentRate": "68.5%",
  "avgCartValue": "$156.78",
  "topAbandonedProducts": [
    { "name": "990v6", "abandonments": 234, "price": "$185" },
    { "name": "Fresh Foam X 1080", "abandonments": 189, "price": "$165" }
  ],
  "timeInCart": {
    "avg": "4:23",
    "median": "2:15"
  },
  "exitReasons": [
    { "reason": "High shipping cost", "percentage": "34%" },
    { "reason": "Unexpected total", "percentage": "28%" },
    { "reason": "Required account creation", "percentage": "18%" }
  ]
}
```

---

### CHECKOUT (Proceso de Pago)
**Datos a mostrar:**

```javascript
{
  "nodeType": "CHECKOUT",
  "sessions": 1789,
  "completionRate": "72.3%",
  "avgTimeToComplete": "3:45",
  "stepBreakdown": [
    { "step": "Shipping info", "dropoff": "12%" },
    { "step": "Payment info", "dropoff": "8%" },
    { "step": "Review order", "dropoff": "5%" },
    { "step": "Complete", "success": "75%" }
  ],
  "paymentMethods": {
    "Credit Card": "65%",
    "PayPal": "25%",
    "Debit Card": "10%"
  },
  "avgOrderValue": "$187.45"
}
```

---

### PROMOCION (Landing Pages)
**Datos a mostrar:**

```javascript
{
  "nodeType": "PROMOCION",
  "sessions": 3456,
  "conversionRate": "8.9%",
  "topCampaigns": [
    {
      "name": "Black Friday 2024",
      "sessions": 1234,
      "conversions": 156,
      "revenue": "$23,456"
    },
    {
      "name": "New Arrivals",
      "sessions": 987,
      "conversions": 98,
      "revenue": "$12,345"
    }
  ],
  "bounceRate": "32.1%",
  "avgSessionDuration": "5:23"
}
```

---

## 3.2. Mejoras en el Backend

### Archivo: `server/services/nodeDataEnricher.js`

```javascript
/**
 * Enriquece los nodos con datos específicos según su tipo
 */
class NodeDataEnricher {
  constructor(ga4Service, bigqueryService) {
    this.ga4Service = ga4Service;
    this.bigqueryService = bigqueryService;
  }

  async enrichNode(node, auth, propertyId, dateRanges) {
    switch(node.type) {
      case 'HOME':
        return await this.enrichHomeNode(node, auth, propertyId, dateRanges);
      case 'CATALOGO':
        return await this.enrichCatalogNode(node, auth, propertyId, dateRanges);
      case 'CART':
        return await this.enrichCartNode(node, auth, propertyId, dateRanges);
      case 'CHECKOUT':
        return await this.enrichCheckoutNode(node, auth, propertyId, dateRanges);
      case 'PROMOCION':
        return await this.enrichPromoNode(node, auth, propertyId, dateRanges);
      default:
        return node;
    }
  }

  async enrichHomeNode(node, auth, propertyId, dateRanges) {
    const searchTerms = await this.ga4Service.getSearchTerms(auth, propertyId, dateRanges);
    const nextPages = await this.ga4Service.getNextPagePaths(auth, propertyId, '/', dateRanges);
    
    return {
      ...node,
      enrichedData: {
        topSearchTerms: searchTerms,
        topNextPages: nextPages,
        bounceRate: await this.calculateBounceRate(auth, propertyId, '/')
      }
    };
  }

  async enrichCatalogNode(node, auth, propertyId, dateRanges) {
    const productData = await this.ga4Service.getProductPerformance(auth, propertyId, dateRanges);
    
    return {
      ...node,
      enrichedData: {
        topProducts: productData.topProducts,
        productsViewedNotAdded: productData.lowConversion,
        avgProductsPerSession: productData.avgPerSession
      }
    };
  }

  // ... más métodos para cada tipo de nodo
}

module.exports = NodeDataEnricher;
```

---

## 3.3. Mejoras en el Frontend

### Archivo: `client/src/components/NodeDetailPanel.tsx`

```typescript
interface NodeDetailPanelProps {
  node: LayoutNode | null;
  onClose: () => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose }) => {
  if (!node) return null;

  const renderNodeContent = () => {
    switch(node.metadata.type) {
      case 'HOME':
        return <HomeNodeDetails data={node.metadata.enrichedData} />;
      case 'CATALOGO':
        return <CatalogNodeDetails data={node.metadata.enrichedData} />;
      case 'CART':
        return <CartNodeDetails data={node.metadata.enrichedData} />;
      case 'CHECKOUT':
        return <CheckoutNodeDetails data={node.metadata.enrichedData} />;
      default:
        return <GenericNodeDetails data={node.metadata} />;
    }
  };

  return (
    <div className="node-detail-panel">
      <div className="panel-header">
        <h2>{node.label}</h2>
        <button onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        {renderNodeContent()}
      </div>
    </div>
  );
};
```

### Componente específico: `HomeNodeDetails.tsx`

```typescript
interface HomeNodeDetailsProps {
  data: {
    topSearchTerms: Array<{ term: string; count: number }>;
    topNextPages: Array<{ page: string; sessions: number; percentage: string }>;
    bounceRate: string;
  };
}

export const HomeNodeDetails: React.FC<HomeNodeDetailsProps> = ({ data }) => {
  return (
    <div className="home-node-details">
      <section>
        <h3>🔍 Términos de Búsqueda Más Populares</h3>
        <div className="search-terms-list">
          {data.topSearchTerms.map((term, i) => (
            <div key={i} className="search-term-item">
              <span className="term">{term.term}</span>
              <span className="count">{term.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>➡️ Páginas Siguientes</h3>
        <div className="next-pages-flow">
          {data.topNextPages.map((page, i) => (
            <div key={i} className="flow-item">
              <div className="flow-bar" style={{ width: page.percentage }}>
                <span className="page-name">{page.page}</span>
                <span className="percentage">{page.percentage}</span>
              </div>
              <span className="sessions">{page.sessions.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>📊 Métricas</h3>
        <div className="metrics-grid">
          <div className="metric">
            <span className="label">Bounce Rate</span>
            <span className="value">{data.bounceRate}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
```

---

## 3.4. Nuevos Endpoints Necesarios

### En `server/routes/nodeData.js`

```javascript
const express = require('express');
const router = express.Router();
const NodeDataEnricher = require('../services/nodeDataEnricher');

// GET /api/node-details/:nodeId
router.get('/node-details/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { token, propertyId, startDate, endDate } = req.query;
    
    // Validar token
    const keyData = authService.getKey(token);
    if (!keyData) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Crear auth client
    const auth = new google.auth.GoogleAuth({
      credentials: keyData.key,
      scopes: SCOPES
    });
    
    // Obtener datos enriquecidos del nodo
    const enricher = new NodeDataEnricher(ga4Service, bigqueryService);
    const nodeData = await enricher.getNodeDetails(
      nodeId,
      auth,
      propertyId,
      { startDate, endDate }
    );
    
    res.json({ status: 'ok', data: nodeData });
  } catch (error) {
    console.error('Error fetching node details:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## 3.5. Queries Específicas de GA4

### Búsquedas (para HOME)

```javascript
// En ga4Service.js
async getSearchTerms(auth, propertyId, dateRanges) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  
  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    dateRanges,
    dimensions: [{ name: 'searchTerm' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: 'view_search_results'
        }
      }
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 10
  });
  
  return response.data.rows?.map(row => ({
    term: row.dimensionValues[0].value,
    count: parseInt(row.metricValues[0].value)
  })) || [];
}
```

### Productos (para CATALOGO)

```javascript
async getProductPerformance(auth, propertyId, dateRanges) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  
  // 1. Product views
  const viewsResponse = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    dateRanges,
    dimensions: [{ name: 'itemName' }],
    metrics: [
      { name: 'itemsViewed' },
      { name: 'itemsAddedToCart' },
      { name: 'itemRevenue' }
    ],
    orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }],
    limit: 20
  });
  
  const products = viewsResponse.data.rows?.map(row => {
    const views = parseInt(row.metricValues[0].value);
    const addToCart = parseInt(row.metricValues[1].value);
    const revenue = parseFloat(row.metricValues[2].value);
    
    return {
      name: row.dimensionValues[0].value,
      views,
      addToCart,
      conversionRate: views > 0 ? ((addToCart / views) * 100).toFixed(1) + '%' : '0%',
      revenue: '$' + revenue.toLocaleString()
    };
  }) || [];
  
  return {
    topProducts: products.slice(0, 10),
    lowConversion: products.filter(p => parseFloat(p.conversionRate) < 20).slice(0, 5)
  };
}
```

### Embudo de Checkout

```javascript
async getCheckoutFunnel(auth, propertyId, dateRanges) {
  const steps = [
    'begin_checkout',
    'add_shipping_info',
    'add_payment_info',
    'purchase'
  ];
  
  const funnelData = await Promise.all(
    steps.map(async (eventName) => {
      const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: eventName }
          }
        }
      });
      
      return {
        step: eventName,
        count: parseInt(response.data.rows?.[0]?.metricValues?.[0]?.value || 0)
      };
    })
  );
  
  // Calcular dropoff rates
  const enriched = funnelData.map((step, i) => {
    if (i === 0) return { ...step, dropoff: '0%' };
    
    const previous = funnelData[i - 1].count;
    const current = step.count;
    const dropoff = ((previous - current) / previous * 100).toFixed(1);
    
    return { ...step, dropoff: dropoff + '%' };
  });
  
  return enriched;
}
```

---

## 3.6. Plan de Implementación

### Semana 1: Backend - Enriquecimiento de Datos
- [ ] Crear `NodeDataEnricher` service
- [ ] Implementar queries específicas en `ga4Service.js`
- [ ] Crear endpoint `/api/node-details/:nodeId`
- [ ] Testing de queries con datos reales

### Semana 2: Frontend - Componentes de Detalle
- [ ] Crear `NodeDetailPanel` component
- [ ] Crear componentes específicos por tipo de nodo:
  - [ ] `HomeNodeDetails`
  - [ ] `CatalogNodeDetails`
  - [ ] `CartNodeDetails`
  - [ ] `CheckoutNodeDetails`
  - [ ] `PromoNodeDetails`
- [ ] Styling con CSS

### Semana 3: Integración y Testing
- [ ] Conectar frontend con nuevo endpoint
- [ ] Testing de cada tipo de nodo
- [ ] Ajustes de UX
- [ ] Optimización de performance

### Semana 4: Pulido y Documentación
- [ ] Manejo de errores
- [ ] Loading states
- [ ] Documentación de nuevos endpoints
- [ ] Testing end-to-end

---

## 3.7. Métricas de Éxito

- ✅ Cada tipo de nodo muestra información específica y útil
- ✅ Los datos se cargan en menos de 2 segundos
- ✅ La información es accionable (permite tomar decisiones)
- ✅ El panel lateral es intuitivo y fácil de navegar
- ✅ Los datos son precisos y coinciden con GA4

---

## 3.8. Consideraciones Técnicas

### Performance
- Implementar caching de datos enriquecidos (5 minutos)
- Lazy loading de datos al hacer clic en nodo
- Pagination para listas largas (productos, búsquedas)

### UX
- Loading skeletons mientras cargan datos
- Mensajes de error claros
- Tooltips explicativos
- Animaciones suaves

### Datos
- Fallback a datos históricos si live data no disponible
- Manejo de casos edge (sin datos, errores de API)
- Validación de datos antes de mostrar

---

## Siguiente Fase (Fase 4): Partículas Animadas y Real-time

Después de completar la Fase 3, la siguiente fase incluirá:
- Partículas animadas que fluyen entre nodos
- Actualización en tiempo real (polling cada 5 minutos)
- Barra de progreso de actualización
- Sistema de caching inteligente

---

## Referencias

- [GA4 Data API - Dimensions & Metrics](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [E-commerce Events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [BigQuery GA4 Export Schema](https://support.google.com/analytics/answer/7029846)
