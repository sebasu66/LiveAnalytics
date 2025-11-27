// Test script to debug GA4 property detection
const { google } = require('googleapis');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'bigquerypatagonia-serviceAccountKey.json');

async function testPropertyDetection() {
    console.log('Testing GA4 Property Detection...\n');

    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE,
        scopes: [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/bigquery.readonly'
        ]
    });

    // Test BigQuery
    console.log('=== Testing BigQuery ===');
    try {
        const bq = google.bigquery({ version: 'v2', auth });
        const keyData = require(KEY_FILE);
        const projectId = keyData.project_id;
        console.log('Project ID:', projectId);

        const response = await bq.datasets.list({ projectId });
        console.log('BigQuery Response Structure:', Object.keys(response));
        console.log('Datasets:', response.data?.datasets?.length || 0);
        if (response.data?.datasets) {
            response.data.datasets.forEach(d => {
                console.log('  -', d.datasetReference.datasetId, '(' + (d.location || 'US') + ')');
            });
        }
    } catch (e) {
        console.error('BigQuery Error:', e.message);
    }

    // Test GA4
    console.log('\n=== Testing GA4 Admin API ===');
    try {
        const admin = google.analyticsadmin({ version: 'v1beta', auth });
        const response = await admin.accountSummaries.list();

        console.log('Response Structure:', Object.keys(response));
        console.log('Data Structure:', Object.keys(response.data || {}));
        console.log('Account Summaries:', response.data?.accountSummaries?.length || 0);

        if (response.data?.accountSummaries) {
            response.data.accountSummaries.forEach(account => {
                console.log('\nAccount:', account.name, '(' + account.account + ')');
                if (account.propertySummaries) {
                    account.propertySummaries.forEach(prop => {
                        console.log('  Property:', prop.displayName);
                        console.log('    ID:', prop.property.split('/')[1]);
                        console.log('    Full:', prop.property);
                    });
                } else {
                    console.log('  No properties found');
                }
            });
        }
    } catch (e) {
        console.error('GA4 Error:', e.message);
        if (e.errors) {
            console.error('Details:', JSON.stringify(e.errors, null, 2));
        }
    }
}

testPropertyDetection().catch(console.error);
