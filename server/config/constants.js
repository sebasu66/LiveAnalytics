module.exports = {
    PORT: 3000,
    SCOPES: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/bigquery.readonly'
    ],
    TOKEN_EXPIRY: 3600000, // 1 hour
    DEFAULT_KEY_FILE: 'bigquerypatagonia-cab338490f70.json'
};
