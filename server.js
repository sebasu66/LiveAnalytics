const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const { PORT } = require('./server/config/constants');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Load Properties Configuration
try {
    const propertiesConfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'properties-config.json'), 'utf8')
    );
    // Make config available globally
    app.locals.propertiesConfig = propertiesConfig;
} catch(e) {
    console.warn("Could not load properties-config.json, some functionality may not work");
    app.locals.propertiesConfig = { properties: [] };
}


// Routes
app.use('/api', require('./server/routes/auth'));
app.use('/api', require('./server/routes/properties'));
app.use('/api', require('./server/routes/historical'));
app.use('/api', require('./server/routes/realtime'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;