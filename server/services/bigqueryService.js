const { google } = require('googleapis');

async function listDatasets(auth, projectId) {
    const bq = google.bigquery({ version: 'v2', auth });
    const response = await bq.datasets.list({ projectId });
    if (response.data && response.data.datasets) {
        return response.data.datasets.map(d => ({
            id: d.datasetReference.datasetId,
            location: d.location || 'US'
        }));
    }
    return [];
}

async function queryHistoricalData(auth, projectId, datasetId, startDate, endDate) {
    const bq = google.bigquery({ version: 'v2', auth });
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
            FROM 
            \`${projectId}.${datasetId}.events_*\`
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

    console.log('Executing BigQuery query for dataset:', datasetId);

    const response = await bq.jobs.query({
        projectId: projectId,
        requestBody: {
            query: query,
            useLegacySql: false
        }
    });

    return response.data.rows || [];
}

async function checkDatasetExists(auth, projectId, datasetId) {
    const bq = google.bigquery({ version: 'v2', auth });
    const response = await bq.datasets.list({ projectId });
    const datasets = response.data.datasets || [];
    return datasets.some(ds => ds.datasetReference.datasetId === datasetId);
}

async function getTablesList(auth, projectId, datasetId) {
    const bq = google.bigquery({ version: 'v2', auth });
    const response = await bq.tables.list({ projectId, datasetId });
    const tables = response.data.tables || [];
    return tables.filter(t => t.tableReference.tableId.startsWith('events_'));
}

module.exports = {
    listDatasets,
    queryHistoricalData,
    checkDatasetExists,
    getTablesList,
};
