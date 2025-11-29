const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { getAuthForProperty, getDefaultAuth } = require('../config/auth');
const bigqueryService = require('../services/bigqueryService');


router.get('/realtime', async (req, res) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' });
    }

    try {
        const auth = getAuthForProperty(propertyId);
        const analyticsData = google.analyticsdata({
            version: 'v1beta',
            auth: auth,
        });

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

router.get('/ecommerce-funnel', async (req, res) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' });
    }
    
    try {
        const auth = getAuthForProperty(propertyId);
        const analyticsData = google.analyticsdata({
            version: 'v1beta',
            auth: auth,
        });

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

        res.status(500).json({
            error: error.message,
            details: 'E-commerce events (view_item, add_to_cart, purchase) with itemName dimension are not available in the GA4 Realtime API for this property. This could mean: 1) E-commerce tracking is not enabled, 2) The itemName dimension is not available in realtime reports, or 3) No e-commerce events have occurred recently.'
        });
    }
});

router.get('/monthly-dashboard', async (req, res) => {
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
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const formatDate = (date) => date.toISOString().split('T')[0].replace(/-/g, '');
        const startDateStr = formatDate(monthStart);
        const endDateStr = formatDate(yesterday);
        
        const auth = getAuthForProperty(propertyId);
        const analyticsData = google.analyticsdata({
            version: 'v1beta',
            auth: auth,
        });
        const defaultAuth = getDefaultAuth();
        const bigquery = google.bigquery({
            version: 'v2',
            auth: defaultAuth
        });

        debugLog.dateRange = {
            monthStart: monthStart.toISOString().split('T')[0],
            yesterday: yesterday.toISOString().split('T')[0],
            today: now.toISOString().split('T')[0]
        };

        let historicalData = null;
        let dataSource = null;

        try {
            debugLog.dataSources.push({ source: 'BigQuery', status: 'attempting' });

            const propertiesConfig = req.app.locals.propertiesConfig;
            const property = propertiesConfig.properties.find(p => p.id === propertyId);
            const projectId = property.bigQueryProjectId;
            const datasetId = property.bigQueryDataset;

            const query = `SELECT 1`;

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
                        limit: 10000
                    }
                });

                historicalData = response.data.rows || [];
                dataSource = 'GA4 Data API';
                debugLog.dataSources.push({ source: 'GA4 Data API', status: 'success', rowCount: historicalData.length });

            } catch (ga4Error) {
                debugLog.dataSources.push({ source: 'GA4 Data API', status: 'failed', error: ga4Error.message });
                debugLog.errors.push(`GA4 Data API failed: ${ga4Error.message}`);

                const errorResponse = {
                    error: 'Unable to fetch e-commerce data from any source',
                    details: 'Both BigQuery and GA4 Data API failed. This likely means e-commerce tracking is not properly configured in your GA4 property.',
                    debug: debugLog
                };
                return res.status(500).json(errorResponse);
            }
        }

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

        debugLog.calculations.push('Starting data aggregation...');

        const productStats = {};

        if (dataSource === 'BigQuery' && historicalData) {
            // This will not run with the simplified query
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

        Object.values(productStats).forEach(product => {
            product.viewToCartRate = product.views > 0 ? ((product.carts / product.views) * 100).toFixed(2) : 0;
            product.cartToPurchaseRate = product.carts > 0 ? ((product.purchases / product.carts) * 100).toFixed(2) : 0;
            product.overallConversionRate = product.views > 0 ? ((product.purchases / product.views) * 100).toFixed(2) : 0;
        });

        const sortedProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

        const topProducts = sortedProducts.slice(0, 10);
        const worstProducts = sortedProducts.slice(-10).reverse();

        const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
        const totalOrders = sortedProducts.reduce((sum, p) => sum + p.purchases, 0);
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;
        const totalViews = sortedProducts.reduce((sum, p) => sum + p.views, 0);
        const overallConversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(2) : 0;

        debugLog.calculations.push(`Total revenue: ${totalRevenue}, Total orders: ${totalOrders}, Avg order value: ${avgOrderValue} `);

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



module.exports = router;
