const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable CORS for frontend
app.use(cors());

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

// ========== PROPERTY MANAGEMENT ENDPOINTS ==========

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

            const [job] = await bigquery.jobs.query({
                projectId: projectId,
                requestBody: {
                    query: query,
                    useLegacySql: false
                }
            });

            historicalData = job.data.rows || [];
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

        debugLog.calculations.push(`Processed ${Object.keys(productStats).length} unique products from historical data`);

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

        debugLog.calculations.push(`Total revenue: ${totalRevenue}, Total orders: ${totalOrders}, Avg order value: ${avgOrderValue}`);

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
        debugLog.errors.push(`Fatal error: ${error.message}`);
        res.status(500).json({
            error: error.message,
            debug: debugLog
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
