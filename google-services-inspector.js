const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function inspectGoogleServices(keyFilePath) {
    if (!fs.existsSync(keyFilePath)) {
        console.error(`Error: Key file not found at '${keyFilePath}'`);
        process.exit(1);
    }

    try {
        const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
        const keys = JSON.parse(keyFileContent);

        const auth = new google.auth.GoogleAuth({
            credentials: keys,
            scopes: [
                'https://www.googleapis.com/auth/analytics.readonly',
                'https://www.googleapis.com/auth/bigquery.readonly',
            ],
        });

        const analyticsAdmin = google.analyticsadmin({
            version: 'v1alpha',
            auth: auth,
        });

        console.log('Fetching Google Analytics account summaries...');
        const { data: { accountSummaries } } = await analyticsAdmin.accountSummaries.list();

        if (!accountSummaries || accountSummaries.length === 0) {
            console.log('No Google Analytics accounts found for this key.');
            return;
        }

        console.log('Found accounts. Now checking properties and BigQuery links...');

        for (const account of accountSummaries) {
            console.log(`
Account: ${account.displayName} (${account.account.split('/')[1]})`);
            if (!account.propertySummaries || account.propertySummaries.length === 0) {
                console.log('  No properties found in this account.');
                continue;
            }

            for (const propertySummary of account.propertySummaries) {
                const propertyName = propertySummary.property;
                const { data: property } = await analyticsAdmin.properties.get({
                    name: propertyName,
                });

                console.log(`  - Property: ${property.displayName} (${property.name.split('/')[1]})`);

                const { data: { dataStreams } } = await analyticsAdmin.properties.dataStreams.list({ parent: propertyName });
                let webStream = null;
                if (dataStreams && dataStreams.length > 0) {
                    webStream = dataStreams.find(ds => ds.webStreamData);
                }
                console.log(`    Website URL: ${webStream ? webStream.webStreamData.defaultUri : 'N/A'}`);
                
                try {
                    const { data: { bigqueryLinks } } = await analyticsAdmin.properties.bigqueryLinks.list({
                        parent: propertyName,
                    });

                    if (bigqueryLinks && bigqueryLinks.length > 0) {
                        bigqueryLinks.forEach(link => {
                            console.log(`    BigQuery Link:`);
                            console.log(`      -> Project: ${link.project}`);
                            console.log(`      -> Dataset: ${link.dataset}`);
                        });
                    } else {
                        console.log(`    No BigQuery links found for this property.`);
                    }
                } catch (e) {
                    console.log(`    Could not retrieve BigQuery links for this property.`);
                }
            }
        }

    } catch (error) {
        console.error('An error occurred:', error.message);
        if (error.response && error.response.data) {
            console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

if (process.argv.length < 3) {
    console.log('Usage: node google-services-inspector.js <path-to-key-file.json>');
    process.exit(1);
}

const keyFilePath = process.argv[2];
inspectGoogleServices(keyFilePath);
