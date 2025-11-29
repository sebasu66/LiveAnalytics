$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/debug-auto-login" -Method Get
Write-Host "✓ Login successful" -ForegroundColor Green
Write-Host "  Token: $($loginResponse.token.Substring(0,10))..."
Write-Host "  Properties: $($loginResponse.ga4Properties.Count)"
Write-Host "  Default Property: $($loginResponse.debugConfig.defaultPropertyId)"
Write-Host "  Default Dataset: $($loginResponse.debugConfig.defaultDataset)"

$token = $loginResponse.token
$propertyId = $loginResponse.debugConfig.defaultPropertyId
$datasetId = $loginResponse.debugConfig.defaultDataset

Write-Host "`nStarting Historical Job..." -ForegroundColor Yellow

$endDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")

$body = @{
    token = $token
    propertyId = $propertyId
    datasetId = $datasetId
    startDate = $startDate
    endDate = $endDate
} | ConvertTo-Json

try {
    $jobResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/start-historical-job" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Job completed" -ForegroundColor Green
    Write-Host "  Nodes: $($jobResponse.data.nodes.Count)"
    Write-Host "  Edges: $($jobResponse.data.edges.Count)"
    Write-Host "  Estimated Sales: $($jobResponse.data.estimatedSales)"
    
    if ($jobResponse.data.nodes.Count -gt 0) {
        Write-Host "`n  Sample nodes:"
        $jobResponse.data.nodes | Select-Object -First 3 | ForEach-Object {
            Write-Host "    - $($_.label) ($($_.type)): $($_.sessions) sessions"
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.Response
}
