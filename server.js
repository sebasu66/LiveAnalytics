const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());


// Serve static files
app.use(express.static(__dirname));

// Load Properties Configuration
const propertiesConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'properties-config.json'), 'utf8')
);

// Helper: Get Auth for specific property
function getAuthForProperty(propertyId) {
    const property = propertiesConfig.properties.find(p => p.id === propertyId);
    if (!property) {
        throw new Error(`Property ${propertyId} not found in configuration`);
    }

    const keyFile = path.join(__dirname, property.serviceAccountKeyFile);
    if (!fs.existsSync(keyFile)) {
        throw new Error(`Service account key file not found: ${property.serviceAccountKeyFile}`);
    }

    return new google.auth.GoogleAuth({
        keyFile: keyFile,
        scopes: [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/bigquery.readonly'
        ]
    });
}

// Default Auth (for backward compatibility)
const KEY_FILE = path.join(__dirname, 'bigquerypatagonia-serviceAccountKey.json');
const SCOPES = [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/bigquery.readonly'
];

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: SCOPES,
});

const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth: auth,
});

const analyticsAdmin = google.analyticsadmin({
    version: 'v1beta',
    auth: auth,
});

const bigquery = google.bigquery({
    version: 'v2',
    auth: auth
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const crypto = require('crypto');

// In-memory storage for temporary keys (Token -> KeyObject)
const TEMP_KEYS = new Map();

// ========== PHASE 1: AUTH & INFRA ==========

// Helper: Create temporary token
function createToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Endpoint: Upload and Validate JSON Key
app.post('/api/upload-key', upload.single('keyFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No key file provided' });
        }

        const keyContent = req.file.buffer.toString('utf8');
        let keyJson;
        try {
            keyJson = JSON.parse(keyContent);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON file' });
        }

        // Basic validation
        if (!keyJson.project_id || !keyJson.client_email || !keyJson.private_key) {
            return res.status(400).json({ error: 'Invalid Service Account Key format' });
        }

        const projectId = keyJson.project_id;

        // Create Auth client for this key
        const tempAuth = new google.auth.GoogleAuth({
            credentials: keyJson,
            scopes: [
                'https://www.googleapis.com/auth/analytics.readonly',
                'https://www.googleapis.com/auth/analytics.edit', // Required for Admin API
                'https://www.googleapis.com/auth/bigquery.readonly'
            ]
        });

        // Detect BigQuery Datasets
        const bq = google.bigquery({ version: 'v2', auth: tempAuth });
        let bqDatasets = [];
        try {
            const response = await bq.datasets.list({ projectId });
            console.log('BigQuery datasets response:', response.data);

            if (response.data && response.data.datasets) {
                bqDatasets = response.data.datasets.map(d => ({
                    id: d.datasetReference.datasetId,
                    location: d.location || 'US'
                }));
            }
            console.log('Detected BigQuery Datasets:', bqDatasets);
        } catch (e) {
            console.warn('BigQuery detection failed:', e.message);
            console.error('Full error:', e);
        }

        // Detect GA4 Properties
        const admin = google.analyticsadmin({ version: 'v1beta', auth: tempAuth });
        let ga4Properties = [];
        try {
            const response = await admin.accountSummaries.list();
            console.log('GA4 API Response:', JSON.stringify(response.data, null, 2));

            if (response.data && response.data.accountSummaries) {
                response.data.accountSummaries.forEach(account => {
                    if (account.propertySummaries) {
                        account.propertySummaries.forEach(prop => {
                            ga4Properties.push({
                                id: prop.property.split('/')[1], // Extract ID from "properties/123456"
                                displayName: prop.displayName,
                                parent: account.account
                            });
                        });
                    }
                });
            }
            console.log('Detected GA4 Properties:', ga4Properties);
        } catch (e) {
            console.warn('GA4 detection failed:', e.message);
            console.error('Full error:', e);
        }

        // Store key temporarily
        const token = createToken();
        TEMP_KEYS.set(token, {
            key: keyJson,
            expires: Date.now() + 3600000 // 1 hour
        });

        res.json({
            status: 'ok',
            token: token,
            projectId: projectId,
            bqDatasets: bqDatasets,
            ga4Properties: ga4Properties,
            message: 'Key validated and stored temporarily for 1 hour.'
        });

    } catch (error) {
        console.error('Upload key error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== DEBUG MODE ENDPOINT ==========
// Auto-load credentials for development/testing
app.get('/api/debug-auto-login', async (req, res) => {
    try {
        // Load debug config
        const debugConfigPath = path.join(__dirname, 'debug.config.json');
        if (!fs.existsSync(debugConfigPath)) {
            return res.status(404).json({
                error: 'Debug mode not configured',
                message: 'Create debug.config.json to enable auto-login'
            });
        }

        const debugConfig = JSON.parse(fs.readFileSync(debugConfigPath, 'utf8'));

        if (!debugConfig.debugMode || !debugConfig.autoLoadKey) {
            return res.status(403).json({
                error: 'Debug mode disabled',
                message: 'Set debugMode and autoLoadKey to true in debug.config.json'
            });
        }

        // Load the key file
        const keyPath = path.join(__dirname, debugConfig.defaultKeyFile);
        if (!fs.existsSync(keyPath)) {
            return res.status(404).json({
                error: 'Key file not found',
                message: `File ${debugConfig.defaultKeyFile} does not exist`
            });
        }

        const keyJson = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        const projectId = keyJson.project_id;

        // Create Auth client
        const tempAuth = new google.auth.GoogleAuth({
            credentials: keyJson,
            scopes: [
                'https://www.googleapis.com/auth/analytics.readonly',
                'https://www.googleapis.com/auth/analytics.edit', // Required for Admin API
                'https://www.googleapis.com/auth/bigquery.readonly'
            ]
        });

        // Detect BigQuery Datasets
        const bq = google.bigquery({ version: 'v2', auth: tempAuth });
        let bqDatasets = [];
        try {
            const response = await bq.datasets.list({ projectId });
            if (response.data && response.data.datasets) {
                bqDatasets = response.data.datasets.map(d => ({
                    id: d.datasetReference.datasetId,
                    location: d.location || 'US'
                }));
            }
        } catch (e) {
            console.warn('BigQuery detection failed:', e.message);
        }

        // Detect GA4 Properties
        const admin = google.analyticsadmin({ version: 'v1beta', auth: tempAuth });
        let ga4Properties = [];
        try {
            const response = await admin.accountSummaries.list();
            if (response.data && response.data.accountSummaries) {
                response.data.accountSummaries.forEach(account => {
                    if (account.propertySummaries) {
                        account.propertySummaries.forEach(prop => {
                            ga4Properties.push({
                                id: prop.property.split('/')[1],
                                displayName: prop.displayName,
                                parent: account.account
                            });
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('GA4 detection failed:', e.message);
        }

        // Store key temporarily
        const token = createToken();
        TEMP_KEYS.set(token, {
            key: keyJson,
            expires: Date.now() + 3600000 // 1 hour
        });

        console.log('🔧 DEBUG MODE: Auto-loaded credentials');
        console.log('   Properties:', ga4Properties.length);
        console.log('   Datasets:', bqDatasets.length);

        res.json({
            status: 'ok',
            token: token,
            projectId: projectId,
            bqDatasets: bqDatasets,
            ga4Properties: ga4Properties,
            message: 'Debug mode: Credentials auto-loaded',
            debugConfig: {
                defaultPropertyId: debugConfig.defaultPropertyId,
                defaultDataset: debugConfig.defaultDataset
            }
        });

    } catch (error) {
        console.error('Debug auto-login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Start Historical Analysis Job
app.post('/api/start-historical-job', async (req, res) => {
    const { token, propertyId, datasetId: providedDatasetId, startDate, endDate } = req.body;

    if (!token || !TEMP_KEYS.has(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { key } = TEMP_KEYS.get(token);

    try {
        const authClient = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/bigquery.readonly', 'https://www.googleapis.com/auth/analytics.readonly']
        });

        const bq = google.bigquery({ version: 'v2', auth: authClient });
        const projectId = key.project_id;

        // Use provided dataset ID or fallback to convention
        let datasetId = providedDatasetId || `analytics_${propertyId}`;
        let rows = [];
        let usedBigQuery = false;

        // Try BigQuery if dataset is provided
        if (providedDatasetId) {
            try {
                // Construct BigQuery SQL
                const query = `
                    WITH session_data AS (
                        SELECT
                            user_pseudo_id,
                            (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') as session_id,
                            MAX((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source')) as source,
                            MAX((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium')) as medium,
                            ARRAY_AGG(
                                (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') 
                                ORDER BY event_timestamp ASC LIMIT 1
                            )[OFFSET(0)] as landing_page
                        FROM \`${projectId}.${datasetId}.events_*\`
                        WHERE _TABLE_SUFFIX BETWEEN '${startDate.replace(/-/g, '')}' AND '${endDate.replace(/-/g, '')}'
                        GROUP BY user_pseudo_id, session_id
                    )
                    SELECT
                        source,
                        medium,
                        landing_page,
                        COUNT(*) as session_count
                    FROM session_data
                    WHERE landing_page IS NOT NULL
                    GROUP BY 1, 2, 3
                    ORDER BY 4 DESC
                    LIMIT 100
                `;

                console.log('Executing BigQuery query for property:', propertyId);

                // Run BigQuery Job
                const response = await bq.jobs.query({
                    projectId: projectId,
                    requestBody: {
                        query: query,
                        useLegacySql: false
                    }
                });

                rows = response.data.rows || [];
                usedBigQuery = true;
                console.log('BigQuery rows returned:', rows.length);
            } catch (bqError) {
                console.warn('BigQuery query failed, falling back to GA4 Data API:', bqError.message);
            }
        }

        // Fallback to GA4 Data API if BigQuery not used or failed
        if (!usedBigQuery) {
            console.log('Using GA4 Data API for traffic source data');
            const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
            const propertyRef = `properties/${propertyId}`;
            const dateRanges = [{ startDate, endDate }];

            try {
                const trafficResponse = await analyticsData.properties.runReport({
                    property: propertyRef,
                    dateRanges,
                    dimensions: [
                        { name: 'sessionSource' },
                        { name: 'sessionMedium' },
                        { name: 'landingPage' }
                    ],
                    metrics: [{ name: 'sessions' }],
                    limit: 100
                });

                // Convert GA4 Data API format to BigQuery-like format
                rows = (trafficResponse.data.rows || []).map(row => ({
                    f: [
                        { v: row.dimensionValues[0].value }, // source
                        { v: row.dimensionValues[1].value }, // medium
                        { v: row.dimensionValues[2].value }, // landing_page
                        { v: row.metricValues[0].value }     // session_count
                    ]
                }));
                console.log('GA4 Data API rows returned:', rows.length);
            } catch (ga4Error) {
                console.error('GA4 Data API also failed:', ga4Error.message);
            }
        }

        // Fetch Demographics & Revenue via GA4 Data API (Parallel)
        const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
        const propertyRef = `properties/${propertyId}`;
        const dateRanges = [{ startDate, endDate }];

        const [ageData, genderData, geoData, deviceData, revenueData] = await Promise.all([
            // 1. Age
            analyticsData.properties.runReport({
                property: propertyRef,
                dateRanges,
                dimensions: [{ name: 'userAgeBracket' }],
                metrics: [{ name: 'activeUsers' }]
            }).catch(e => ({ data: { rows: [] } })),

            // 2. Gender
            analyticsData.properties.runReport({
                property: propertyRef,
                dateRanges,
                dimensions: [{ name: 'userGender' }],
                metrics: [{ name: 'activeUsers' }]
            }).catch(e => ({ data: { rows: [] } })),

            // 3. Geo (Country)
            analyticsData.properties.runReport({
                property: propertyRef,
                dateRanges,
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 10
            }).catch(e => ({ data: { rows: [] } })),

            // 4. Device
            analyticsData.properties.runReport({
                property: propertyRef,
                dateRanges,
                dimensions: [{ name: 'deviceCategory' }],
                metrics: [{ name: 'activeUsers' }]
            }).catch(e => ({ data: { rows: [] } })),

            // 5. Total Revenue
            analyticsData.properties.runReport({
                property: propertyRef,
                dateRanges,
                metrics: [{ name: 'grossPurchaseRevenue' }]
            }).catch(e => ({ data: { rows: [] } }))
        ]);

        // Process Data API Results
        const demographics = {
            age: ageData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
            gender: genderData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
            geo: geoData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
            device: deviceData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || []
        };

        const totalRevenue = parseFloat(revenueData.data?.rows?.[0]?.metricValues?.[0]?.value || '0');

        // Helper: Translate specific terms
        function translateTerm(term) {
            if (!term) return '';
            const lower = term.toLowerCase();
            const map = {
                'organic': 'Orgánico',
                'referral': 'Referencia',
                '(none)': 'Directo',
                '(direct)': 'Directo',
                'cpc': 'Pago (CPC)',
                'email': 'Email',
                'social': 'Social',
                'desktop': 'Escritorio',
                'mobile': 'Móvil',
                'tablet': 'Tablet',
                'male': 'Hombre',
                'female': 'Mujer',
                'unknown': 'Desconocido'
            };
            return map[lower] || term;
        }

        // Apply translations
        demographics.device.forEach(d => d.name = translateTerm(d.name));
        demographics.gender.forEach(d => d.name = translateTerm(d.name));

        // Helper function to categorize traffic sources
        function categorizeSource(source, medium) {
            const sourceLower = source.toLowerCase();
            const mediumLower = medium.toLowerCase();

            if (mediumLower.includes('cpc') || mediumLower.includes('ppc') ||
                mediumLower.includes('paid') || sourceLower.includes('ads')) {
                return 'Campañas Ads';
            }

            if (mediumLower.includes('social') ||
                ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest']
                    .some(s => sourceLower.includes(s))) {
                return 'Redes Sociales';
            }

            return 'Orgánico';
        }

        // Helper function to group pages
        function groupPage(pagePath) {
            if (!pagePath || pagePath === '/') return 'Inicio';

            const parts = pagePath.split('/').filter(p => p.length > 0);
            if (parts.length === 0) return 'Inicio';

            const mainPath = '/' + parts[0];
            const lowerPath = mainPath.toLowerCase();

            if (lowerPath.includes('product') || lowerPath.includes('collection') || lowerPath.includes('shop')) return 'Productos';
            if (lowerPath.includes('blog') || lowerPath.includes('article') || lowerPath.includes('news')) return 'Blog';
            if (lowerPath.includes('about') || lowerPath.includes('nosotros') || lowerPath.includes('company')) return 'Nosotros';
            if (lowerPath.includes('contact') || lowerPath.includes('contacto')) return 'Contacto';
            if (lowerPath.includes('cart') || lowerPath.includes('checkout') || lowerPath.includes('basket')) return 'Checkout';
            if (lowerPath.includes('login') || lowerPath.includes('signin') || lowerPath.includes('account')) return 'Cuenta';
            if (lowerPath.includes('search') || lowerPath.includes('buscar')) return 'Búsqueda';

            return mainPath.replace('/', '').charAt(0).toUpperCase() + mainPath.slice(2);
        }

        // Create grouped nodes
        const sourceGroups = new Map();
        const pageGroups = new Map();
        const flowMap = new Map();

        rows.forEach((row) => {
            const source = row.f[0].v || '(direct)';
            const medium = row.f[1].v || '(none)';
            const landingPageFull = row.f[2].v || 'Unknown';
            const count = parseInt(row.f[3].v);

            const sourceCategory = categorizeSource(source, medium);

            let landingPage = landingPageFull;
            try {
                const url = new URL(landingPageFull);
                landingPage = url.pathname;
            } catch (e) {
                // Keep as is
            }

            const pageGroup = groupPage(landingPage);

            // Aggregate source data
            if (!sourceGroups.has(sourceCategory)) {
                sourceGroups.set(sourceCategory, { sessions: 0, details: [] });
            }
            const sourceData = sourceGroups.get(sourceCategory);
            sourceData.sessions += count;

            const detailKey = `${source}/${medium}`;
            let detail = sourceData.details.find(d => d.key === detailKey);
            if (!detail) {
                const displaySource = translateTerm(source);
                const displayMedium = translateTerm(medium);
                detail = { key: detailKey, source: displaySource, medium: displayMedium, sessions: 0 };
                sourceData.details.push(detail);
            }
            detail.sessions += count;

            // Aggregate page data
            if (!pageGroups.has(pageGroup)) {
                pageGroups.set(pageGroup, { sessions: 0, details: [] });
            }
            const pageData = pageGroups.get(pageGroup);
            pageData.sessions += count;

            let pageDetail = pageData.details.find(d => d.path === landingPage);
            if (!pageDetail) {
                pageDetail = { path: landingPage, sessions: 0 };
                pageData.details.push(pageDetail);
            }
            pageDetail.sessions += count;

            const flowKey = `${sourceCategory}::${pageGroup}`;
            flowMap.set(flowKey, (flowMap.get(flowKey) || 0) + count);
        });

        const nodes = [];
        const edges = [];

        sourceGroups.forEach((data, category) => {
            nodes.push({
                id: `source_${category.replace(/\s+/g, '_')}`,
                type: 'source_group',
                label: category,
                sessions: data.sessions,
                layer: 0,
                details: data.details.sort((a, b) => b.sessions - a.sessions)
            });
        });

        pageGroups.forEach((data, pageGroup) => {
            nodes.push({
                id: `page_${pageGroup.replace(/\s+/g, '_').replace(/\//g, '_')}`,
                type: 'entry_point',
                label: pageGroup,
                sessions: data.sessions,
                layer: 1,
                details: data.details.sort((a, b) => b.sessions - a.sessions).slice(0, 20)
            });
        });

        flowMap.forEach((count, flowKey) => {
            const [sourceCategory, pageGroup] = flowKey.split('::');
            const sourceId = `source_${sourceCategory.replace(/\s+/g, '_')}`;
            const targetId = `page_${pageGroup.replace(/\s+/g, '_').replace(/\//g, '_')}`;

            edges.push({
                source: sourceId,
                target: targetId,
                value: count
            });
        });

        res.json({
            status: 'completed',
            data: {
                nodes,
                edges,
                dateRange: { startDate, endDate },
                demographics,
                estimatedSales: totalRevenue
            }
        });

    } catch (error) {
        console.error('========== HISTORICAL JOB ERROR ==========');
        console.error('Error message:', error.message);
        if (error.errors) console.error('BigQuery errors:', JSON.stringify(error.errors, null, 2));
        res.status(500).json({
            error: error.message,
            details: error.errors || error.response?.data || 'No additional details available'
        });
    }
});

// Endpoint: Inspect Data (Sample of what's available)
app.post('/api/inspect-data', async (req, res) => {
    const { token, propertyId, startDate, endDate } = req.body;

    if (!token || !TEMP_KEYS.has(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { key } = TEMP_KEYS.get(token);

    try {
        const authClient = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly']
        });

        const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
        const propertyRef = `properties/${propertyId}`;
        const dateRanges = [{ startDate: startDate || '30daysAgo', endDate: endDate || 'today' }];

        // 1. Get Metadata (Available Dimensions/Metrics)
        const metadata = await analyticsData.properties.getMetadata({
            name: `${propertyRef}/metadata`
        });

        // 2. Get a sample report
        const sampleReport = await analyticsData.properties.runReport({
            property: propertyRef,
            dateRanges,
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
            limit: 10
        });

        res.json({
            status: 'ok',
            availableDimensions: metadata.data.dimensions?.slice(0, 20).map(d => d.apiName) || [],
            availableMetrics: metadata.data.metrics?.slice(0, 20).map(m => m.apiName) || [],
            sampleEventData: sampleReport.data.rows || []
        });

    } catch (error) {
        console.error('Inspect data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of all configured properties
app.get('/api/properties', (req, res) => {
    try {
        const properties = propertiesConfig.properties.map(p => ({
            id: p.id,
            name: p.name,
            domain: p.domain,
            enabled: p.enabled,
            serviceAccountKey: path.basename(p.serviceAccountKeyFile)
        }));
        res.json({ properties });
    } catch (error) {
        console.error('Error loading properties:', error);
        res.status(500).json({ error: error.message });
    }
});

// BigQuery verification endpoint
app.get('/api/bigquery-status/:propertyId', async (req, res) => {
    const { propertyId } = req.params;

    try {
        const property = propertiesConfig.properties.find(p => p.id === propertyId);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const propertyAuth = getAuthForProperty(propertyId);
        const bq = google.bigquery({ version: 'v2', auth: propertyAuth });

        const projectId = property.bigQueryProjectId;
        const datasetId = property.bigQueryDataset;

        // Check if dataset exists
        const [datasets] = await bq.datasets.list({ projectId });
        const datasetExists = datasets.some(ds => ds.datasetReference.datasetId === datasetId);

        if (!datasetExists) {
            return res.json({
                available: false,
                error: `Dataset ${datasetId} not found in project ${projectId}`
            });
        }

        // Get list of tables
        const [tables] = await bq.tables.list({ projectId, datasetId });
        const eventTables = tables.filter(t => t.tableReference.tableId.startsWith('events_'));

        // Extract dates from table names
        const dates = eventTables
            .map(t => t.tableReference.tableId.replace('events_', ''))
            .sort();

        res.json({
            available: true,
            dataset: datasetId,
            projectId: projectId,
            tables: {
                count: eventTables.length,
                oldestDate: dates[0],
                newestDate: dates[dates.length - 1]
            }
        });

    } catch (error) {
        console.error('BigQuery status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GA4 API verification endpoint
app.get('/api/ga4-status/:propertyId', async (req, res) => {
    const { propertyId } = req.params;

    try {
        const propertyAuth = getAuthForProperty(propertyId);
        const ga4 = google.analyticsdata({ version: 'v1beta', auth: propertyAuth });

        const startTime = Date.now();

        // Test Data API
        const dataApiResponse = await ga4.properties.runReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 1
            }
        });

        const dataApiTime = Date.now() - startTime;

        // Test Realtime API
        const realtimeStart = Date.now();
        const realtimeResponse = await ga4.properties.runRealtimeReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dimensions: [{ name: 'unifiedScreenName' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 1
            }
        });

        const realtimeApiTime = Date.now() - realtimeStart;

        res.json({
            dataApi: {
                available: true,
                responseTime: dataApiTime,
                hasData: dataApiResponse.data.rows && dataApiResponse.data.rows.length > 0
            },
            realtimeApi: {
                available: true,
                responseTime: realtimeApiTime,
                hasData: realtimeResponse.data.rows && realtimeResponse.data.rows.length > 0
            }
        });

    } catch (error) {
        console.error('GA4 status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Complete verification endpoint
app.get('/api/verify-property/:propertyId', async (req, res) => {
    const { propertyId } = req.params;

    try {
        const property = propertiesConfig.properties.find(p => p.id === propertyId);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        // Run both verifications in parallel
        const [bigQueryStatus, ga4Status] = await Promise.all([
            (async () => {
                try {
                    const response = await fetch(`http://localhost:${PORT}/api/bigquery-status/${propertyId}`);
                    return await response.json();
                } catch (e) {
                    return { available: false, error: e.message };
                }
            })(),
            (async () => {
                try {
                    const response = await fetch(`http://localhost:${PORT}/api/ga4-status/${propertyId}`);
                    return await response.json();
                } catch (e) {
                    return { available: false, error: e.message };
                }
            })()
        ]);

        const verification = {
            propertyId,
            propertyName: property.name,
            timestamp: new Date().toISOString(),
            bigQuery: bigQueryStatus,
            ga4Api: ga4Status,
            overallHealth: (bigQueryStatus.available && ga4Status.dataApi?.available) ? 'good' : 'fair'
        };

        res.json(verification);

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== EXISTING ENDPOINTS ==========


// Endpoint: Get Realtime Data
// Requires ?propertyId=...
app.get('/api/realtime', async (req, res) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' });
    }

    try {
        const response = await analyticsData.properties.runRealtimeReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dimensions: [
                    { name: 'unifiedScreenName' },
                    { name: 'country' },
                    { name: 'deviceCategory' }
                ],
                metrics: [
                    { name: 'activeUsers' }
                ]
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching realtime data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Get E-commerce Funnel Data
app.get('/api/ecommerce-funnel', async (req, res) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' });
    }

    try {
        const response = await analyticsData.properties.runRealtimeReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dimensions: [
                    { name: 'eventName' },
                    { name: 'itemName' }
                ],
                metrics: [
                    { name: 'eventCount' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'eventName',
                        inListFilter: {
                            values: ['view_item', 'add_to_cart', 'purchase']
                        }
                    }
                }
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching e-commerce funnel data:', error.message);
        console.error('Error details:', JSON.stringify(error.errors || error, null, 2));

        // Return a structured error response
        res.status(500).json({
            error: error.message,
            details: 'E-commerce events (view_item, add_to_cart, purchase) with itemName dimension are not available in the GA4 Realtime API for this property. This could mean: 1) E-commerce tracking is not enabled, 2) The itemName dimension is not available in realtime reports, or 3) No e-commerce events have occurred recently.'
        });
    }
});

// Endpoint: Monthly Dashboard with Real-time Enrichment
app.get('/api/monthly-dashboard', async (req, res) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' });
    }

    const debugLog = {
        timestamp: new Date().toISOString(),
        dataSources: [],
        calculations: [],
        errors: []
    };

    try {
        // Calculate date range (current month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const formatDate = (date) => date.toISOString().split('T')[0].replace(/-/g, '');
        const startDateStr = formatDate(monthStart);
        const endDateStr = formatDate(yesterday);

        debugLog.dateRange = {
            monthStart: monthStart.toISOString().split('T')[0],
            yesterday: yesterday.toISOString().split('T')[0],
            today: now.toISOString().split('T')[0]
        };

        let historicalData = null;
        let dataSource = null;

        // Try BigQuery first
        try {
            debugLog.dataSources.push({ source: 'BigQuery', status: 'attempting' });

            const projectId = 'bigquerypatagonia';
            const datasetId = `analytics_${propertyId}`;

            const query = `
                SELECT
                  items.item_name as product_name,
                  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN user_pseudo_id END) as purchase_users,
                  SUM(CASE WHEN event_name = 'purchase' THEN items.quantity ELSE 0 END) as units_sold,
                  SUM(CASE WHEN event_name = 'purchase' THEN items.price * items.quantity ELSE 0 END) as revenue,
                  COUNT(DISTINCT CASE WHEN event_name = 'view_item' THEN user_pseudo_id END) as view_users,
                  COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN user_pseudo_id END) as cart_users,
                  PARSE_DATE('%Y%m%d', event_date) as date
                FROM \`${projectId}.${datasetId}.events_*\`,
                UNNEST(items) as items
                WHERE _TABLE_SUFFIX BETWEEN '${startDateStr}' AND '${endDateStr}'
                  AND event_name IN ('purchase', 'add_to_cart', 'view_item')
                GROUP BY items.item_name, event_date
                ORDER BY revenue DESC
            `;

            debugLog.bigQueryQuery = query;

            const response = await bigquery.jobs.query({
                projectId: projectId,
                requestBody: {
                    query: query,
                    useLegacySql: false
                }
            });

            historicalData = response.data.rows || [];
            dataSource = 'BigQuery';
            debugLog.dataSources.push({ source: 'BigQuery', status: 'success', rowCount: historicalData.length });

        } catch (bqError) {
            debugLog.dataSources.push({ source: 'BigQuery', status: 'failed', error: bqError.message });
            debugLog.errors.push(`BigQuery failed: ${bqError.message}`);

            // Fallback to GA4 Data API
            try {
                debugLog.dataSources.push({ source: 'GA4 Data API', status: 'attempting' });

                const response = await analyticsData.properties.runReport({
                    property: `properties/${propertyId}`,
                    requestBody: {
                        dateRanges: [{
                            startDate: debugLog.dateRange.monthStart,
                            endDate: debugLog.dateRange.yesterday
                        }],
                        dimensions: [
                            { name: 'itemName' },
                            { name: 'date' }
                        ],
                        metrics: [
                            { name: 'itemRevenue' },
                            { name: 'itemsPurchased' },
                            { name: 'itemsViewed' },
                            { name: 'itemsAddedToCart' }
                        ],
                        // Limit to reasonable amount of data
                        limit: 10000
                    }
                });

                historicalData = response.data.rows || [];
                dataSource = 'GA4 Data API';
                debugLog.dataSources.push({ source: 'GA4 Data API', status: 'success', rowCount: historicalData.length });

            } catch (ga4Error) {
                debugLog.dataSources.push({ source: 'GA4 Data API', status: 'failed', error: ga4Error.message });
                debugLog.errors.push(`GA4 Data API failed: ${ga4Error.message}`);

                // If both BigQuery and GA4 failed, return error with debug info
                const errorResponse = {
                    error: 'Unable to fetch e-commerce data from any source',
                    details: 'Both BigQuery and GA4 Data API failed. This likely means e-commerce tracking is not properly configured in your GA4 property.',
                    debug: debugLog
                };
                return res.status(500).json(errorResponse);
            }
        }

        // Fetch real-time data for today (just for active users count)
        let realtimeData = null;
        try {
            debugLog.dataSources.push({ source: 'GA4 Realtime', status: 'attempting' });

            const rtResponse = await analyticsData.properties.runRealtimeReport({
                property: `properties/${propertyId}`,
                requestBody: {
                    dimensions: [
                        { name: 'unifiedScreenName' }
                    ],
                    metrics: [
                        { name: 'activeUsers' }
                    ]
                }
            });

            realtimeData = rtResponse.data.rows || [];
            debugLog.dataSources.push({ source: 'GA4 Realtime', status: 'success', rowCount: realtimeData.length });

        } catch (rtError) {
            debugLog.dataSources.push({ source: 'GA4 Realtime', status: 'failed', error: rtError.message });
            debugLog.errors.push(`Realtime API failed: ${rtError.message}`);
        }

        // Process and merge data
        debugLog.calculations.push('Starting data aggregation...');

        const productStats = {};

        // Process historical data
        if (dataSource === 'BigQuery' && historicalData) {
            historicalData.forEach(row => {
                const productName = row.f[0].v;
                if (!productStats[productName]) {
                    productStats[productName] = {
                        name: productName,
                        revenue: 0,
                        units: 0,
                        views: 0,
                        carts: 0,
                        purchases: 0
                    };
                }
                productStats[productName].revenue += parseFloat(row.f[3].v || 0);
                productStats[productName].units += parseInt(row.f[2].v || 0);
                productStats[productName].views += parseInt(row.f[4].v || 0);
                productStats[productName].carts += parseInt(row.f[5].v || 0);
                productStats[productName].purchases += parseInt(row.f[1].v || 0);
            });
        } else if (dataSource === 'GA4 Data API' && historicalData) {
            historicalData.forEach(row => {
                const productName = row.dimensionValues[0].value;
                if (!productStats[productName]) {
                    productStats[productName] = {
                        name: productName,
                        revenue: 0,
                        units: 0,
                        views: 0,
                        carts: 0,
                        purchases: 0
                    };
                }
                productStats[productName].revenue += parseFloat(row.metricValues[0].value || 0);
                productStats[productName].units += parseInt(row.metricValues[1].value || 0);
                productStats[productName].views += parseInt(row.metricValues[2].value || 0);
                productStats[productName].carts += parseInt(row.metricValues[3].value || 0);
            });
        }

        debugLog.calculations.push(`Processed ${Object.keys(productStats).length
            } unique products from historical data`);

        // Calculate conversion rates
        Object.values(productStats).forEach(product => {
            product.viewToCartRate = product.views > 0 ? ((product.carts / product.views) * 100).toFixed(2) : 0;
            product.cartToPurchaseRate = product.carts > 0 ? ((product.purchases / product.carts) * 100).toFixed(2) : 0;
            product.overallConversionRate = product.views > 0 ? ((product.purchases / product.views) * 100).toFixed(2) : 0;
        });

        // Sort products by revenue
        const sortedProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

        const topProducts = sortedProducts.slice(0, 10);
        const worstProducts = sortedProducts.slice(-10).reverse();

        // Calculate overall metrics
        const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
        const totalOrders = sortedProducts.reduce((sum, p) => sum + p.purchases, 0);
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;
        const totalViews = sortedProducts.reduce((sum, p) => sum + p.views, 0);
        const overallConversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(2) : 0;

        debugLog.calculations.push(`Total revenue: ${totalRevenue}, Total orders: ${totalOrders}, Avg order value: ${avgOrderValue} `);

        // Calculate bounce rate from realtime data (simplified)
        const activeUsers = realtimeData ? realtimeData.reduce((sum, row) => sum + parseInt(row.metricValues[0].value || 0), 0) : 0;

        const response = {
            period: {
                start: debugLog.dateRange.monthStart,
                end: debugLog.dateRange.yesterday,
                today: debugLog.dateRange.today,
                dataSource: dataSource,
                hasRealtimeEnrichment: realtimeData !== null
            },
            topProducts: topProducts,
            worstProducts: worstProducts,
            metrics: {
                totalRevenue: totalRevenue,
                totalOrders: totalOrders,
                avgOrderValue: parseFloat(avgOrderValue),
                overallConversionRate: parseFloat(overallConversionRate),
                activeUsersNow: activeUsers
            },
            debug: debugLog
        };

        res.json(response);

    } catch (error) {
        console.error('Error in monthly dashboard:', error);
        debugLog.errors.push(`Fatal error: ${error.message} `);
        res.status(500).json({
            error: error.message,
            debug: debugLog
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
