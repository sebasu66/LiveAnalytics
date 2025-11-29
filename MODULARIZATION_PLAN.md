# Plan de Modularización de server.js

## Objetivo
Dividir `server.js` (1255 líneas) en módulos organizados siguiendo principios SOLID y separación de responsabilidades.

## Estructura Propuesta

```
server/
├── config/
│   ├── auth.js              # Configuración de Google Auth
│   └── constants.js         # Constantes y configuraciones
├── middleware/
│   └── upload.js            # Configuración de Multer
├── services/
│   ├── authService.js       # Manejo de tokens temporales y validación de keys
│   ├── bigqueryService.js   # Queries a BigQuery
│   ├── ga4Service.js        # Queries a GA4 (Data API y Realtime API)
│   └── dataProcessor.js     # Procesamiento, agrupación y normalización de datos
├── routes/
│   ├── auth.js              # POST /api/upload-key, GET /api/debug-auto-login
│   ├── properties.js        # GET /api/properties, /api/verify-property, etc.
│   ├── historical.js        # POST /api/start-historical-job, /api/inspect-data
│   └── realtime.js          # GET /api/realtime, /api/ecommerce-funnel, /api/monthly-dashboard
├── utils/
│   ├── helpers.js           # Funciones auxiliares (translateTerm, categorizeSource, groupPage)
│   └── validators.js        # Validaciones de datos
└── server.js                # Archivo principal (solo configuración y rutas)
```

## Detalle de Módulos

### 1. `server/config/auth.js`
**Responsabilidad**: Configuración de autenticación de Google Cloud

**Exporta**:
```javascript
module.exports = {
    getAuthForProperty(propertyId),  // Retorna GoogleAuth para una propiedad específica
    getDefaultAuth(),                 // Retorna GoogleAuth por defecto
    SCOPES                           // Array de scopes necesarios
};
```

**Contenido**:
- Función `getAuthForProperty(propertyId)` (líneas 24-42 de server.js)
- Configuración de auth por defecto (líneas 44-69)
- Constantes de SCOPES

---

### 2. `server/config/constants.js`
**Responsabilidad**: Constantes de la aplicación

**Exporta**:
```javascript
module.exports = {
    PORT: 3000,
    SCOPES: [...],
    TOKEN_EXPIRY: 3600000, // 1 hora
    DEFAULT_KEY_FILE: 'bigquerypatagonia-serviceAccountKey.json'
};
```

---

### 3. `server/middleware/upload.js`
**Responsabilidad**: Configuración de Multer para upload de archivos

**Exporta**:
```javascript
const multer = require('multer');
module.exports = multer({ storage: multer.memoryStorage() });
```

---

### 4. `server/services/authService.js`
**Responsabilidad**: Manejo de tokens temporales y validación de service account keys

**Exporta**:
```javascript
module.exports = {
    TEMP_KEYS: new Map(),           // Storage de tokens
    createToken(),                   // Genera token aleatorio
    validateKey(keyJson),            // Valida formato de service account key
    storeKey(token, keyJson),        // Almacena key con token
    getKey(token),                   // Recupera key por token
    isTokenValid(token)              // Verifica si token existe y no expiró
};
```

**Contenido**:
- Map de TEMP_KEYS (línea 76)
- Función createToken() (líneas 81-83)
- Lógica de validación de keys (líneas 100-103)
- Almacenamiento temporal con expiración

---

### 5. `server/services/bigqueryService.js`
**Responsabilidad**: Queries y operaciones con BigQuery

**Exporta**:
```javascript
module.exports = {
    listDatasets(auth, projectId),
    queryHistoricalData(auth, projectId, datasetId, startDate, endDate, propertyId),
    checkDatasetExists(auth, projectId, datasetId),
    getTablesList(auth, projectId, datasetId)
};
```

**Contenido**:
- Queries de BigQuery (líneas 322-363 de server.js)
- Lógica de detección de datasets (líneas 118-134)
- Verificación de disponibilidad de BigQuery (líneas 724-758)

---

### 6. `server/services/ga4Service.js`
**Responsabilidad**: Queries a Google Analytics 4

**Exporta**:
```javascript
module.exports = {
    listProperties(auth),
    getRealtimeData(auth, propertyId),
    getHistoricalReport(auth, propertyId, startDate, endDate, dimensions, metrics),
    getDemographics(auth, propertyId, dateRanges),
    getRevenue(auth, propertyId, dateRanges),
    checkGA4Status(auth, propertyId)
};
```

**Contenido**:
- Detección de propiedades GA4 (líneas 136-160)
- Queries de GA4 Data API (líneas 370-402, 409-449)
- Queries de GA4 Realtime API (líneas 784-796)
- Verificación de estado de GA4 (líneas 762-806)

---

### 7. `server/services/dataProcessor.js`
**Responsabilidad**: Procesamiento, agrupación y normalización de datos

**Exporta**:
```javascript
module.exports = {
    processHistoricalData(rows, demographics, totalRevenue),
    normalizeGA4Response(ga4Rows),
    buildGraphData(sourceGroups, pageGroups, flowMap),
    aggregateNodeData(nodes, edges)
};
```

**Contenido**:
- Función `categorizeSource()` (líneas 488-504)
- Función `groupPage()` (líneas 507-564) **← YA ACTUALIZADA CON CATEGORÍAS GENÉRICAS**
- Lógica de agrupación de nodos (líneas 527-583)
- Construcción de nodos y edges (líneas 585-620)

---

### 8. `server/utils/helpers.js`
**Responsabilidad**: Funciones auxiliares reutilizables

**Exporta**:
```javascript
module.exports = {
    translateTerm(term),         // Traduce términos al español
    categorizeSource(source, medium),  // Categoriza fuentes de tráfico
    groupPage(pagePath)          // Agrupa páginas en categorías genéricas
};
```

**Contenido**:
- Función `translateTerm()` (líneas 462-481)
- Función `categorizeSource()` (líneas 488-504)
- Función `groupPage()` (líneas 507-564)

---

### 9. `server/routes/auth.js`
**Responsabilidad**: Rutas de autenticación

**Rutas**:
- `POST /api/upload-key` (líneas 86-182)
- `GET /api/debug-auto-login` (líneas 186-293)

**Ejemplo**:
```javascript
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const ga4Service = require('../services/ga4Service');
const bigqueryService = require('../services/bigqueryService');
const upload = require('../middleware/upload');

router.post('/upload-key', upload.single('keyFile'), async (req, res) => {
    // Lógica de upload-key
});

router.get('/debug-auto-login', async (req, res) => {
    // Lógica de debug auto-login
});

module.exports = router;
```

---

### 10. `server/routes/properties.js`
**Responsabilidad**: Rutas relacionadas con propiedades

**Rutas**:
- `GET /api/properties` (líneas 692-706)
- `GET /api/bigquery-status/:propertyId` (líneas 709-758)
- `GET /api/ga4-status/:propertyId` (líneas 762-806)
- `GET /api/verify-property/:propertyId` (líneas 809-900)

---

### 11. `server/routes/historical.js`
**Responsabilidad**: Rutas de datos históricos

**Rutas**:
- `POST /api/start-historical-job` (líneas 296-642)
- `POST /api/inspect-data` (líneas 645-689)

---

### 12. `server/routes/realtime.js`
**Responsabilidad**: Rutas de datos en tiempo real

**Rutas**:
- `GET /api/realtime` (líneas 903-1000)
- `GET /api/ecommerce-funnel` (líneas 1003-1100)
- `GET /api/monthly-dashboard` (líneas 1103-1200)

---

## Nuevo `server.js` (Simplificado)

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const { PORT } = require('./server/config/constants');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Load Properties Configuration
const propertiesConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'properties-config.json'), 'utf8')
);

// Make config available globally
app.locals.propertiesConfig = propertiesConfig;

// Routes
app.use('/api', require('./server/routes/auth'));
app.use('/api', require('./server/routes/properties'));
app.use('/api', require('./server/routes/historical'));
app.use('/api', require('./server/routes/realtime'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
```

---

## Pasos de Implementación

### Paso 1: Crear estructura de carpetas
```bash
mkdir -p server/config server/middleware server/services server/routes server/utils
```

### Paso 2: Crear archivos base (en orden)
1. `server/config/constants.js`
2. `server/config/auth.js`
3. `server/middleware/upload.js`
4. `server/utils/helpers.js`
5. `server/services/authService.js`
6. `server/services/bigqueryService.js`
7. `server/services/ga4Service.js`
8. `server/services/dataProcessor.js`
9. `server/routes/auth.js`
10. `server/routes/properties.js`
11. `server/routes/historical.js`
12. `server/routes/realtime.js`

### Paso 3: Actualizar server.js
Reemplazar el contenido de `server.js` con la versión simplificada

### Paso 4: Testing
- Verificar que todas las rutas funcionen
- Probar upload de keys
- Probar debug mode
- Probar queries históricas
- Probar queries en tiempo real

---

## Beneficios de la Modularización

1. **Mantenibilidad**: Cada módulo tiene una responsabilidad clara
2. **Testabilidad**: Más fácil escribir tests unitarios
3. **Reutilización**: Servicios pueden ser usados por múltiples rutas
4. **Escalabilidad**: Fácil agregar nuevas funcionalidades
5. **Legibilidad**: Código más organizado y fácil de entender
6. **Colaboración**: Múltiples desarrolladores pueden trabajar en paralelo

---

## Notas Importantes

- **MANTENER** la función `groupPage()` actualizada con categorías genéricas (HOME, CATALOGO, CART, CHECKOUT, CONTACTO, PROMOCION, OTROS)
- **NO PERDER** la lógica de debug mode
- **PRESERVAR** el sistema de tokens temporales
- **MANTENER** compatibilidad con el frontend React existente
- **ASEGURAR** que todas las rutas sigan funcionando igual

---

## Verificación Final

Después de modularizar, verificar que:
- [ ] El servidor inicia sin errores
- [ ] Todas las rutas responden correctamente
- [ ] El frontend en puerto 5173 sigue funcionando
- [ ] El debug mode funciona
- [ ] Las queries a BigQuery funcionan
- [ ] Las queries a GA4 funcionan
- [ ] Los datos se agrupan correctamente en categorías genéricas
