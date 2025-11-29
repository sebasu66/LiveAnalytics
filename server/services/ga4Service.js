const { google } = require('googleapis');

async function listProperties(auth) {
    const admin = google.analyticsadmin({ version: 'v1beta', auth });
    let ga4Properties = [];
    const response = await admin.accountSummaries.list();
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
    return ga4Properties;
}

async function getRealtimeData(auth, propertyId) {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
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
    return response.data;
}

async function getHistoricalReport(auth, propertyId, startDate, endDate, dimensions, metrics) {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
    const propertyRef = `properties/${propertyId}`;
    const dateRanges = [{ startDate, endDate }];

    console.log('[GA4] Requesting report:', { propertyRef, startDate, endDate });

    const response = await analyticsData.properties.runReport({
        property: propertyRef,
        requestBody: {
            dateRanges,
            dimensions,
            metrics,
            limit: 100
        }
    });

    console.log('[GA4] Response rows:', response.data.rows?.length || 0);
    if (response.data.rows?.length > 0) {
        console.log('[GA4] Sample row:', JSON.stringify(response.data.rows[0]));
    }

    return (response.data.rows || []);
}

async function getDemographics(auth, propertyId, dateRanges) {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
    const propertyRef = `properties/${propertyId}`;

    const [ageData, genderData, geoData, deviceData] = await Promise.all([
        analyticsData.properties.runReport({
            property: propertyRef,
            dateRanges,
            dimensions: [{ name: 'userAgeBracket' }],
            metrics: [{ name: 'activeUsers' }]
        }).catch(e => ({ data: { rows: [] } })),
        analyticsData.properties.runReport({
            property: propertyRef,
            dateRanges,
            dimensions: [{ name: 'userGender' }],
            metrics: [{ name: 'activeUsers' }]
        }).catch(e => ({ data: { rows: [] } })),
        analyticsData.properties.runReport({
            property: propertyRef,
            dateRanges,
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }],
            limit: 10
        }).catch(e => ({ data: { rows: [] } })),
        analyticsData.properties.runReport({
            property: propertyRef,
            dateRanges,
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }]
        }).catch(e => ({ data: { rows: [] } }))
    ]);

    return {
        age: ageData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
        gender: genderData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
        geo: geoData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || [],
        device: deviceData.data?.rows?.map(r => ({ name: r.dimensionValues[0].value, value: parseInt(r.metricValues[0].value) })) || []
    };
}

async function getRevenue(auth, propertyId, dateRanges) {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
    const propertyRef = `properties/${propertyId}`;

    const revenueData = await analyticsData.properties.runReport({
        property: propertyRef,
        dateRanges,
        metrics: [{ name: 'grossPurchaseRevenue' }]
    }).catch(e => ({ data: { rows: [] } }));

    return parseFloat(revenueData.data?.rows?.[0]?.metricValues?.[0]?.value || '0');
}

async function checkGA4Status(auth, propertyId) {
    const ga4 = google.analyticsdata({ version: 'v1beta', auth });
    const startTime = Date.now();

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
}


module.exports = {
    listProperties,
    getRealtimeData,
    getHistoricalReport,
    getDemographics,
    getRevenue,
    checkGA4Status
};