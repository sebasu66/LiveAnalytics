// Verification endpoints for multi-property system

// Verify BigQuery data availability for a property
async function verifyBigQuery(propertyId) {
    try {
        const property = propertiesConfig.properties.find(p => p.id === propertyId);
        if (!property) {
            return { available: false, error: 'Property not found' };
        }

        const propertyAuth = getAuthForProperty(propertyId);
        const bq = google.bigquery({ version: 'v2', auth: propertyAuth });

        const projectId = property.bigQueryProjectId;
        const datasetId = property.bigQueryDataset;

        // Check if dataset exists
        const [datasets] = await bq.datasets.list({ projectId });
        const datasetExists = datasets.some(ds => ds.datasetReference.datasetId === datasetId);

        if (!datasetExists) {
            return {
                available: false,
                error: `Dataset ${datasetId} not found in project ${projectId}`
            };
        }

        // Get list of tables
        const [tables] = await bq.tables.list({ projectId, datasetId });
        const eventTables = tables.filter(t => t.tableReference.tableId.startsWith('events_'));

        // Extract dates from table names
        const dates = eventTables
            .map(t => t.tableReference.tableId.replace('events_', ''))
            .sort();

        return {
            available: true,
            dataset: datasetId,
            projectId: projectId,
            tables: {
                count: eventTables.length,
                oldestDate: dates[0],
                newestDate: dates[dates.length - 1]
            }
        };

    } catch (error) {
        console.error('BigQuery verification error:', error);
        return { available: false, error: error.message };
    }
}

// Verify GA4 API availability for a property
async function verifyGA4(propertyId) {
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

        return {
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
        };

    } catch (error) {
        console.error('GA4 verification error:', error);
        return {
            dataApi: { available: false, error: error.message },
            realtimeApi: { available: false, error: error.message }
        };
    }
}

module.exports = { verifyBigQuery, verifyGA4 };
