const fetch = require('node-fetch');

async function testApi() {
    try {
        const res = await fetch('http://localhost:3000/api/realtime?propertyId=407838284');
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

testApi();
