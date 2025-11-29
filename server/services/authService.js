const crypto = require('crypto');
const { TOKEN_EXPIRY } = require('../config/constants');

const TEMP_KEYS = new Map();

function createToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateKey(keyJson) {
    if (!keyJson.project_id || !keyJson.client_email || !keyJson.private_key) {
        throw new Error('Invalid Service Account Key format');
    }
    return true;
}

function storeKey(token, keyJson) {
    TEMP_KEYS.set(token, {
        key: keyJson,
        expires: Date.now() + TOKEN_EXPIRY
    });
}

function getKey(token) {
    const data = TEMP_KEYS.get(token);
    if (!data || Date.now() > data.expires) {
        TEMP_KEYS.delete(token);
        return null;
    }
    return data.key;
}

function isTokenValid(token) {
    return getKey(token) !== null;
}

module.exports = {
    TEMP_KEYS,
    createToken,
    validateKey,
    storeKey,
    getKey,
    isTokenValid
};