param(
  [string]$ApiBase = "http://localhost:8000",
  [string]$GatewayBase = "http://localhost:8090"
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Assert-True($name, $cond) {
  if ($cond) { Write-Host "[PASS] $name" -ForegroundColor Green; $script:pass++ }
  else { Write-Host "[FAIL] $name" -ForegroundColor Red; $script:fail++ }
}

try {
  $h = Invoke-RestMethod "$ApiBase/health"
  Assert-True "API health" ($h.ok -eq $true)
} catch { Assert-True "API health" $false }

try {
  $gh = Invoke-RestMethod "$GatewayBase/health"
  Assert-True "Gateway health" ($gh.ok -eq $true)
} catch { Assert-True "Gateway health" $false }

$owner = Invoke-RestMethod -Method Post "$ApiBase/auth/dev-token?role=owner"
$viewer = Invoke-RestMethod -Method Post "$ApiBase/auth/dev-token?role=viewer"
Assert-True "Token owner" (![string]::IsNullOrWhiteSpace($owner.token))
Assert-True "Token viewer" (![string]::IsNullOrWhiteSpace($viewer.token))

$authOwner = @{ Authorization = "Bearer $($owner.token)"; "content-type" = "application/json" }
$authViewer = @{ Authorization = "Bearer $($viewer.token)"; "content-type" = "application/json" }

try {
  $c = Invoke-RestMethod "$ApiBase/config/current" -Headers $authViewer
  Assert-True "Viewer read config" ($c.env.APP_NAME -ne $null)
} catch { Assert-True "Viewer read config" $false }

try {
  Invoke-RestMethod -Method Post "$ApiBase/config/apply" -Headers $authViewer -Body '{"settings":{"X":"1"}}' | Out-Null
  Assert-True "Viewer blocked apply" $false
} catch {
  Assert-True "Viewer blocked apply" $true
}

$eid = [guid]::NewGuid().ToString()
$evId = [guid]::NewGuid().ToString()
$trId = [guid]::NewGuid().ToString()

Invoke-RestMethod -Method Post "$ApiBase/entities/upsert" -Headers $authOwner -Body (@{id=$eid;type='lead';full_name='Teste';contact_phone='+550000000'} | ConvertTo-Json)
Invoke-RestMethod -Method Post "$ApiBase/events/upsert" -Headers $authOwner -Body (@{id=$evId;entity_id=$eid;status='scheduled';scheduled_for=$null} | ConvertTo-Json)
Invoke-RestMethod -Method Post "$ApiBase/transactions/upsert" -Headers $authOwner -Body (@{id=$trId;event_id=$evId;amount='100';type='income';status='pending'} | ConvertTo-Json)

$pull = Invoke-RestMethod "$ApiBase/mobile/sync/pull?since=1970-01-01T00:00:00+00:00" -Headers $authOwner
Assert-True "Sync pull entities" ($pull.changes.entities.Count -ge 1)
Assert-True "Sync pull events" ($pull.changes.events.Count -ge 1)
Assert-True "Sync pull transactions" ($pull.changes.transactions.Count -ge 1)

$triage = Invoke-RestMethod -Method Post "$ApiBase/ai/triage" -Headers $authOwner -Body (@{text='confirmo presença'} | ConvertTo-Json)
Assert-True "AI fallback triage" ($triage.intent -eq 'confirm')

Write-Host ""
Write-Host "TOTAL PASS: $pass" -ForegroundColor Green
Write-Host "TOTAL FAIL: $fail" -ForegroundColor Yellow
if ($fail -gt 0) {
  Write-Host "GO/NO-GO: NO-GO" -ForegroundColor Red
  exit 1
}
Write-Host "GO/NO-GO: GO" -ForegroundColor Green
