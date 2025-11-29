const { categorizeSource, groupPage, translateTerm } = require('../utils/helpers');

function processHistoricalData(rows, demographics, totalRevenue) {
    // This function will be more complex, for now, it just processes demographics
    demographics.device.forEach(d => d.name = translateTerm(d.name));
    demographics.gender.forEach(d => d.name = translateTerm(d.name));
    return { demographics, totalRevenue };
}

function normalizeGA4Response(ga4Rows) {
     console.log('[DataProcessor] normalizing GA4 rows:', ga4Rows?.length || 0);
     const normalized = (ga4Rows || []).map(row => ({
        f: [
            { v: row.dimensionValues[0]?.value || '(none)' }, // source
            { v: row.dimensionValues[1]?.value || '(none)' }, // medium
            { v: row.dimensionValues[2]?.value || '/' }, // landing_page
            { v: row.metricValues[0]?.value || '0' }     // session_count
        ]
    }));
     console.log('[DataProcessor] normalized sample:', JSON.stringify(normalized.slice(0, 2)));
     return normalized;
}

function buildGraphData(rows) {
    const sourceGroups = new Map();
    const pageGroups = new Map();
    const flowMap = new Map();

    rows.forEach((row) => {
        const source = row.f[0].v || '(direct)';
        const medium = row.f[1].v || '(none)';
        const landingPageFull = row.f[2].v || 'Unknown';
        const count = parseInt(row.f[3].v);

        const sourceCategory = categorizeSource(source, medium);

        let landingPage = landingPageFull;
        try {
            const url = new URL(landingPageFull);
            landingPage = url.pathname;
        } catch (e) {
            // Keep as is
        }

        const pageGroup = groupPage(landingPage);

        // Aggregate source data
        if (!sourceGroups.has(sourceCategory)) {
            sourceGroups.set(sourceCategory, { sessions: 0, details: [] });
        }
        const sourceData = sourceGroups.get(sourceCategory);
        sourceData.sessions += count;

        const detailKey = `${source}/${medium}`;
        let detail = sourceData.details.find(d => d.key === detailKey);
        if (!detail) {
            const displaySource = translateTerm(source);
            const displayMedium = translateTerm(medium);
            detail = { key: detailKey, source: displaySource, medium: displayMedium, sessions: 0 };
            sourceData.details.push(detail);
        }
        detail.sessions += count;

        // Aggregate page data
        if (!pageGroups.has(pageGroup)) {
            pageGroups.set(pageGroup, { sessions: 0, details: [] });
        }
        const pageData = pageGroups.get(pageGroup);
        pageData.sessions += count;

        let pageDetail = pageData.details.find(d => d.path === landingPage);
        if (!pageDetail) {
            pageDetail = { path: landingPage, sessions: 0 };
            pageData.details.push(pageDetail);
        }
        pageDetail.sessions += count;

        const flowKey = `${sourceCategory}::${pageGroup}`;
        flowMap.set(flowKey, (flowMap.get(flowKey) || 0) + count);
    });

    const nodes = [];
    const edges = [];

    sourceGroups.forEach((data, category) => {
        nodes.push({
            id: `source_${category.replace(/\s+/g, '_')}`,
            type: 'source_group',
            label: category,
            sessions: data.sessions,
            layer: 0,
            details: data.details.sort((a, b) => b.sessions - a.sessions)
        });
    });

    pageGroups.forEach((data, pageGroup) => {
        nodes.push({
            id: `page_${pageGroup.replace(/\s+/g, '_').replace(/\//g, '_')}`,
            type: 'entry_point',
            label: pageGroup,
            sessions: data.sessions,
            layer: 1,
            details: data.details.sort((a, b) => b.sessions - a.sessions).slice(0, 20)
        });
    });

    flowMap.forEach((count, flowKey) => {
        const [sourceCategory, pageGroup] = flowKey.split('::');
        const sourceId = `source_${sourceCategory.replace(/\s+/g, '_')}`;
        const targetId = `page_${pageGroup.replace(/\s+/g, '_').replace(/\//g, '_')}`;

        edges.push({
            source: sourceId,
            target: targetId,
            value: count
        });
    });

    return { nodes, edges };
}

function aggregateNodeData(nodes, edges) {
    // This function is not implemented in server.js
    // I will leave it empty for now
    return { nodes, edges };
}


module.exports = {
    processHistoricalData,
    normalizeGA4Response,
    buildGraphData,
    aggregateNodeData
};