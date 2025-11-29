const http = require('http');
const https = require('https');

async function testFlow() {
    try {
        console.log('Step 1: Debug Auto Login...');
        const loginResponse = await axios.get('http://localhost:3000/api/debug-auto-login');
        console.log('✓ Login successful');
        console.log('  Token:', loginResponse.data.token ? 'YES' : 'NO');
        console.log('  Properties:', loginResponse.data.ga4Properties.length);
        console.log('  Default Property:', loginResponse.data.debugConfig.defaultPropertyId);
        console.log('  Default Dataset:', loginResponse.data.debugConfig.defaultDataset);

        const token = loginResponse.data.token;
        const propertyId = loginResponse.data.debugConfig.defaultPropertyId;
        const datasetId = loginResponse.data.debugConfig.defaultDataset;

        console.log('\nStep 2: Start Historical Job...');
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const jobResponse = await axios.post('http://localhost:3000/api/start-historical-job', {
            token: token,
            propertyId: propertyId,
            datasetId: datasetId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });

        console.log('✓ Job completed');
        console.log('  Nodes:', jobResponse.data.data.nodes.length);
        console.log('  Edges:', jobResponse.data.data.edges.length);
        console.log('  Estimated Sales:', jobResponse.data.data.estimatedSales);

        if (jobResponse.data.data.nodes.length > 0) {
            console.log('\n  Sample nodes:');
            jobResponse.data.data.nodes.slice(0, 3).forEach(node => {
                console.log(`    - ${node.label} (${node.type}): ${node.sessions} sessions`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testFlow();
