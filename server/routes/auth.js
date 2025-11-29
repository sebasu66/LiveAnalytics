const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const fs =require('fs');
const path = require('path');
const authService = require('../services/authService');
const ga4Service = require('../services/ga4Service');
const bigqueryService = require('../services/bigqueryService');
const upload = require('../middleware/upload');

router.post('/upload-key', upload.single('keyFile'), async (req, res) => {
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

        try {
            authService.validateKey(keyJson);
        } catch (e) {
            return res.status(400).json({ error: e.message });
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
        let bqDatasets = [];
        try {
            bqDatasets = await bigqueryService.listDatasets(tempAuth, projectId);
            console.log('Detected BigQuery Datasets:', bqDatasets);
        } catch (e) {
            console.warn('BigQuery detection failed:', e.message);
            console.error('Full error:', e);
        }

        // Detect GA4 Properties
        let ga4Properties = [];
        try {
            ga4Properties = await ga4Service.listProperties(tempAuth);
            console.log('Detected GA4 Properties:', ga4Properties);
        } catch (e) {
            console.warn('GA4 detection failed:', e.message);
            console.error('Full error:', e);
        }

        // Store key temporarily
        const token = authService.createToken();
        authService.storeKey(token, keyJson);


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

router.get('/debug-auto-login', async (req, res) => {
    try {
        // Load debug config
        const debugConfigPath = path.join(__dirname, '..', '..', 'debug.config.json');
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
        const keyPath = path.join(__dirname, '..', '..', debugConfig.defaultKeyFile);
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
        let bqDatasets = [];
        try {
            bqDatasets = await bigqueryService.listDatasets(tempAuth, projectId);
        } catch (e) {
            console.warn('BigQuery detection failed:', e.message);
        }

        // Detect GA4 Properties
        let ga4Properties = [];
        try {
            ga4Properties = await ga4Service.listProperties(tempAuth);
        } catch (e) {
            console.warn('GA4 detection failed:', e.message);
        }

        // Store key temporarily
        const token = authService.createToken();
        authService.storeKey(token, keyJson);


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


module.exports = router;
