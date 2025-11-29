const express = require('express');
const router = express.Router();
const path = require('path');
const { getAuthForProperty } = require('../config/auth');
const bigqueryService = require('../services/bigqueryService');
const ga4Service = require('../services/ga4Service');
const { PORT } = require('../config/constants');
const fetch = require('node-fetch');

router.get('/properties', (req, res) => {
    try {
        const propertiesConfig = req.app.locals.propertiesConfig;
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

router.get('/bigquery-status/:propertyId', async (req, res) => {
    const { propertyId } = req.params;
    const propertiesConfig = req.app.locals.propertiesConfig;

    try {
        const property = propertiesConfig.properties.find(p => p.id === propertyId);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const propertyAuth = getAuthForProperty(propertyId);
        const projectId = property.bigQueryProjectId;
        const datasetId = property.bigQueryDataset;

        const datasetExists = await bigqueryService.checkDatasetExists(propertyAuth, projectId, datasetId);

        if (!datasetExists) {
            return res.json({
                available: false,
                error: `Dataset ${datasetId} not found in project ${projectId}`
            });
        }

        const tables = await bigqueryService.getTablesList(propertyAuth, projectId, datasetId);
        const dates = tables
            .map(t => t.tableReference.tableId.replace('events_', ''))
            .sort();

        res.json({
            available: true,
            dataset: datasetId,
            projectId: projectId,
            tables: {
                count: tables.length,
                oldestDate: dates[0],
                newestDate: dates[dates.length - 1]
            }
        });

    } catch (error) {
        console.error('BigQuery status error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/ga4-status/:propertyId', async (req, res) => {
    const { propertyId } = req.params;

    try {
        const propertyAuth = getAuthForProperty(propertyId);
        const status = await ga4Service.checkGA4Status(propertyAuth, propertyId);
        res.json(status);
    } catch (error) {
        console.error('GA4 status error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/verify-property/:propertyId', async (req, res) => {
    const { propertyId } = req.params;
    const propertiesConfig = req.app.locals.propertiesConfig;

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
                    return { dataApi: { available: false, error: e.message }, realtimeApi: { available: false, error: e.message } };
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

module.exports = router;