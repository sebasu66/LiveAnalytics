const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const propertiesConfig = require('../../properties-config.json');
const { SCOPES, DEFAULT_KEY_FILE } = require('./constants');

function getAuthForProperty(propertyId) {
    const property = propertiesConfig.properties.find(p => p.id === propertyId);
    if (!property) {
        throw new Error(`Property ${propertyId} not found in configuration`);
    }

    const keyFile = path.join(__dirname, '..', '..', property.serviceAccountKeyFile);
    if (!fs.existsSync(keyFile)) {
        throw new Error(`Service account key file not found: ${property.serviceAccountKeyFile}`);
    }

    return new google.auth.GoogleAuth({
        keyFile: keyFile,
        scopes: SCOPES
    });
}

function getDefaultAuth() {
    const keyFile = path.join(__dirname, '..', '..', DEFAULT_KEY_FILE);
     if (!fs.existsSync(keyFile)) {
        throw new Error(`Default service account key file not found: ${DEFAULT_KEY_FILE}`);
    }
    return new google.auth.GoogleAuth({
        keyFile: keyFile,
        scopes: SCOPES,
    });
}

module.exports = {
    getAuthForProperty,
    getDefaultAuth,
    SCOPES
};