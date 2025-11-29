$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/debug-auto-login" -Method Get
Write-Host "Token: $($loginResponse.token.Substring(0,10))..."

$token = $loginResponse.token
$propertyId = $loginResponse.debugConfig.defaultPropertyId
$datasetId = $loginResponse.debugConfig.defaultDataset

Write-Host "Property: $propertyId"
Write-Host "Dataset: $datasetId"

$endDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")

$body = @{
    token = $token
    propertyId = $propertyId
    datasetId = $datasetId
    startDate = $startDate
    endDate = $endDate
} | ConvertTo-Json

Write-Host "`nCalling /api/start-historical-job..."
$jobResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/start-historical-job" -Method Post -Body $body -ContentType "application/json"

Write-Host "Status: $($jobResponse.status)"
Write-Host "Nodes: $($jobResponse.data.nodes.Count)"
Write-Host "Edges: $($jobResponse.data.edges.Count)"
Write-Host "Estimated Sales: $($jobResponse.data.estimatedSales)"

if ($jobResponse.data.nodes.Count -gt 0) {
    Write-Host "`nFirst 3 nodes:"
    $jobResponse.data.nodes | Select-Object -First 3 | ForEach-Object {
        Write-Host "  - $($_.label) ($($_.type)): $($_.sessions) sessions"
    }
} else {
    Write-Host "`nNO NODES RETURNED!"
}
