import { Node } from './Node.js';

const PROPERTY_ID = '407838284'; // Converse Perú

export class DataService {
    constructor() {
        this.liveDataBuffer = [];
        this.flowData = [];
    }

    async fetchLiveData(nodes, nodesMap) {
        try {
            const res = await fetch(`http://localhost:3000/api/realtime?propertyId=${PROPERTY_ID}`);
            const data = await res.json();
            console.log('Live Data Response:', data);

            if (data.rows && data.rows.length > 0) {
                this.processLiveData(data.rows, nodes, nodesMap);
            } else {
                console.warn('No live data rows returned. Using fallback data.');
                this.generateFallbackData(nodes, nodesMap);
            }

            this.updateUI();

        } catch (e) {
            console.error('Failed to fetch live data', e);
        }
    }

    processLiveData(rows, nodes, nodesMap) {
        this.liveDataBuffer = [];
        const pageCounts = {};

        // 1. Aggregate Counts
        rows.forEach(row => {
            let screenName = row.dimensionValues[0].value;
            if (!screenName || screenName === '(not set)') screenName = 'Home';

            const count = parseInt(row.metricValues[0].value, 10);
            pageCounts[screenName] = (pageCounts[screenName] || 0) + count;
        });

        // 2. Identify Top 15 Pages
        const sortedPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);
        const topPages = sortedPages.slice(0, 15).map(p => p[0]);
        const otherPagesCount = sortedPages.slice(15).reduce((acc, curr) => acc + curr[1], 0);

        // 3. Rebuild Nodes (Keep Sources, Reset Pages)
        nodes.length = 0;
        Object.keys(nodesMap).forEach(key => {
            if (nodesMap[key].type === 'source') {
                nodes.push(nodesMap[key]);
            } else {
                delete nodesMap[key];
            }
        });

        // Create Top Page Nodes (Right Column)
        const rightX = 600;
        const startY = -400;
        const gapY = 80;

        topPages.forEach((pageName, index) => {
            const nodeId = 'page_' + pageName.replace(/[^a-zA-Z0-9]/g, '_');
            const newNode = new Node({
                id: nodeId,
                x: rightX,
                y: startY + (index * gapY),
                label: pageName, // Store FULL label
                type: 'step'
            });
            nodes.push(newNode);
            nodesMap[nodeId] = newNode;
        });

        // Create "Other Pages" Node if needed
        if (otherPagesCount > 0) {
            const otherNode = new Node({
                id: 'page_other',
                x: rightX,
                y: startY + (topPages.length * gapY),
                label: 'Other Pages (' + sortedPages.slice(15).length + ')',
                type: 'step'
            });
            nodes.push(otherNode);
            nodesMap['page_other'] = otherNode;
        }

        // 4. Populate Live Data Buffer & Flow Data
        this.flowData = [];

        rows.forEach(row => {
            let screenName = row.dimensionValues[0].value;
            if (!screenName || screenName === '(not set)') screenName = 'Home';

            let targetPageName = screenName;
            if (!topPages.includes(screenName)) targetPageName = 'Other Pages';

            let targetNodeId = 'page_' + targetPageName.replace(/[^a-zA-Z0-9]/g, '_');
            if (targetPageName === 'Other Pages') targetNodeId = 'page_other';

            const device = row.dimensionValues[2].value;
            const country = row.dimensionValues[1].value;
            const count = parseInt(row.metricValues[0].value, 10);

            for (let i = 0; i < count; i++) {
                const rand = Math.random();
                let mappedSource = 'source_direct';
                if (rand < 0.33) mappedSource = 'source_google';
                else if (rand < 0.66) mappedSource = 'source_social';

                this.liveDataBuffer.push({
                    source: mappedSource,
                    targetNodeId: targetNodeId,
                    device: device.toLowerCase(),
                    geo: country === 'Peru' ? 'us' : 'eu',
                    type: Math.random() > 0.5 ? 'new' : 'returning'
                });

                const flow = this.flowData.find(f => f.source === mappedSource && f.target === targetNodeId);
                if (flow) flow.count++;
                else this.flowData.push({ source: mappedSource, target: targetNodeId, count: 1 });
            }
        });

        console.log(`Processed ${this.liveDataBuffer.length} users, ${topPages.length} top pages.`);
        document.getElementById('activeUsers').innerText = this.liveDataBuffer.length;
    }

    generateFallbackData(nodes, nodesMap) {
        const fallbackRows = [];
        const pages = ['Home', 'Men', 'Women', 'Kids', 'Sale', 'Cart', 'Checkout', 'About', 'Contact', 'Blog', 'News', 'Support', 'FAQ', 'Login', 'Register', 'Profile', 'Orders', 'Returns'];

        pages.forEach(p => {
            fallbackRows.push({
                dimensionValues: [{ value: p }, { value: 'Peru' }, { value: 'mobile' }],
                metricValues: [{ value: Math.floor(Math.random() * 50) + 5 }]
            });
        });
        this.processLiveData(fallbackRows, nodes, nodesMap);
        document.getElementById('activeUsers').innerText = this.liveDataBuffer.length + " (Demo)";
    }

    updateUI() {
        document.querySelector('.status-indicator').innerHTML = '<span class="dot" style="background:#00C853; box-shadow: 0 0 10px #00C853;"></span> Live Data (Active)';
        document.querySelector('.controls-panel .control-group').style.display = 'none';
        document.querySelector('.controls-panel h3').innerText = 'Live Data Stats';

        let distributionDiv = document.getElementById('liveDistribution');
        if (!distributionDiv) {
            distributionDiv = document.createElement('div');
            distributionDiv.id = 'liveDistribution';
            distributionDiv.style.marginTop = '10px';
            distributionDiv.style.fontSize = '12px';
            distributionDiv.style.color = '#aaa';
            document.querySelector('.controls-panel').insertBefore(distributionDiv, document.querySelector('.controls-panel h3').nextSibling);
        }

        const devices = this.liveDataBuffer.reduce((acc, curr) => {
            acc[curr.device] = (acc[curr.device] || 0) + 1;
            return acc;
        }, {});

        const total = this.liveDataBuffer.length || 1;
        distributionDiv.innerHTML = `
            <div style="margin-bottom:5px; font-weight:bold; color:#fff;">Device Distribution:</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Desktop:</span> <span>${Math.round((devices['desktop'] || 0) / total * 100)}%</span></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Mobile:</span> <span>${Math.round((devices['mobile'] || 0) / total * 100)}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Tablet:</span> <span>${Math.round((devices['tablet'] || 0) / total * 100)}%</span></div>
        `;
    }
}
