# 🔧 Debug Mode - Quick Start Guide

## What is Debug Mode?

Debug mode allows you to **skip the manual JSON key upload** every time you refresh the page during development. The application will automatically load your credentials from a local file.

## Setup (One-Time)

### 1. Create `debug.config.json`
Already created for you with these settings:
```json
{
  "debugMode": true,
  "autoLoadKey": true,
  "defaultKeyFile": "bigquerypatagonia-serviceAccountKey.json",
  "defaultPropertyId": "427321367",
  "defaultDataset": "analytics_427321367"
}
```

### 2. Verify Your Key File
Make sure `bigquerypatagonia-serviceAccountKey.json` exists in the root directory.

### 3. Update Default Property/Dataset (Optional)
Edit `debug.config.json` to match your preferred defaults:
- `defaultPropertyId`: The GA4 property ID you want to use
- `defaultDataset`: The BigQuery dataset name

## How It Works

When you open **http://localhost:5173**:

1. ✅ **Frontend** calls `/api/debug-auto-login`
2. ✅ **Backend** reads `debug.config.json`
3. ✅ **Backend** loads your JSON key file
4. ✅ **Backend** detects all properties and datasets
5. ✅ **Frontend** auto-selects your default property/dataset
6. ✅ **You're ready to test!** No upload needed

## Visual Indicator

When debug mode is active, you'll see:
- 🔧 **DEBUG MODE** badge in the dashboard header (orange)
- Console message: "🔧 Debug mode enabled - auto-loading credentials"

## Disable Debug Mode

### Temporary (keep file)
Set `debugMode: false` in `debug.config.json`

### Permanent (remove file)
Delete or rename `debug.config.json`

## Security Notes

⚠️ **IMPORTANT:**
- `debug.config.json` is in `.gitignore` - it won't be committed
- Never commit your service account JSON keys
- Debug mode should **only be used in development**
- For production, always use the upload flow

## Testing Workflow

### Before (Manual)
1. Open http://localhost:5173
2. Click "Select JSON Key File"
3. Browse and upload
4. Wait for validation
5. Select property
6. Select dataset
7. Click continue
8. **Total: ~30 seconds per refresh**

### After (Debug Mode)
1. Open http://localhost:5173
2. **Automatically logged in!**
3. Property and dataset pre-selected
4. Click continue
5. **Total: ~3 seconds per refresh**

## Troubleshooting

### "Debug mode not available"
- Check `debug.config.json` exists
- Verify `debugMode: true` and `autoLoadKey: true`

### "Key file not found"
- Check `defaultKeyFile` path in `debug.config.json`
- Verify the JSON key file exists

### Properties not showing
- Check backend console for errors
- Verify service account has correct permissions

## Example: Testing Different Properties

```json
{
  "debugMode": true,
  "autoLoadKey": true,
  "defaultKeyFile": "bigquerypatagonia-serviceAccountKey.json",
  "defaultPropertyId": "338208380",  // CAT 2022
  "defaultDataset": "analytics_338208380"
}
```

Just edit, save, and refresh! 🚀

## API Endpoint

You can also test the endpoint directly:

```bash
curl http://localhost:3000/api/debug-auto-login
```

Returns the same response as `/api/upload-key` but without needing to upload anything.
