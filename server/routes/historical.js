const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const authService = require('../services/authService');
const bigqueryService = require('../services/bigqueryService');
const ga4Service = require('../services/ga4Service');
const dataProcessor = require('../services/dataProcessor');


router.post('/start-historical-job', async (req, res) => {
    const { token, propertyId, datasetId: providedDatasetId, startDate, endDate } = req.body;

    if (!authService.isTokenValid(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const key = authService.getKey(token);

    try {
        const authClient = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/bigquery.readonly', 'https://www.googleapis.com/auth/analytics.readonly']
        });

        const projectId = key.project_id;
        let datasetId = providedDatasetId || `analytics_${propertyId}`;
        let rows = [];
        let usedBigQuery = false;

        if (providedDatasetId) {
            try {
                rows = await bigqueryService.queryHistoricalData(authClient, projectId, datasetId, startDate, endDate);
                usedBigQuery = true;
                console.log('BigQuery rows returned:', rows.length);
            } catch (bqError) {
                console.warn('BigQuery query failed, falling back to GA4 Data API:', bqError.message);
            }
        }

        if (!usedBigQuery) {
            console.log('Using GA4 Data API for traffic source data');
            console.log('[DEBUG] propertyId:', propertyId, 'startDate:', startDate, 'endDate:', endDate);
            try {
                const ga4Rows = await ga4Service.getHistoricalReport(authClient, propertyId, startDate, endDate,
                    [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'landingPage' }],
                    [{ name: 'sessions' }]
                );
                rows = dataProcessor.normalizeGA4Response(ga4Rows);
                console.log('GA4 Data API rows returned:', rows.length);
            } catch (ga4Error) {
                console.error('GA4 Data API also failed:', ga4Error.message);
            }
        }

        console.log(`[Historical Job] Rows retrieved: ${rows.length}`);
        if (rows.length > 0) {
            console.log('[Historical Job] Sample row:', JSON.stringify(rows[0]));
        }

        const dateRanges = [{ startDate, endDate }];
        const [demographics, totalRevenue] = await Promise.all([
            ga4Service.getDemographics(authClient, propertyId, dateRanges),
            ga4Service.getRevenue(authClient, propertyId, dateRanges)
        ]);

        const processedData = dataProcessor.processHistoricalData([], demographics, totalRevenue);
        const { nodes, edges } = dataProcessor.buildGraphData(rows);

        console.log(`[Historical Job] Generated nodes: ${nodes.length}, edges: ${edges.length}`);

        res.json({
            status: 'completed',
            data: {
                nodes,
                edges,
                dateRange: { startDate, endDate },
                demographics: processedData.demographics,
                estimatedSales: processedData.totalRevenue
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

router.post('/inspect-data', async (req, res) => {
    const { token, propertyId, startDate, endDate } = req.body;

    if (!authService.isTokenValid(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const key = authService.getKey(token);

    try {
        const authClient = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly']
        });

        const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
        const propertyRef = `properties/${propertyId}`;
        const dateRanges = [{ startDate: startDate || '30daysAgo', endDate: endDate || 'today' }];

        const metadata = await analyticsData.properties.getMetadata({
            name: `${propertyRef}/metadata`
        });

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


module.exports = router;
