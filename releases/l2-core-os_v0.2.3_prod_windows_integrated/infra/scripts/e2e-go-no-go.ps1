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

function Get-EnvValue($path, $key, $default="") {
  if (!(Test-Path $path)) { return $default }
  $line = Get-Content $path | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return $default }
  return ($line -replace "^$key=","").Trim()
}

try {
  $h = Invoke-RestMethod "$ApiBase/health"
  Assert-True "API health" ($h.ok -eq $true)
} catch { Assert-True "API health" $false }

$gwOk = $false
for($i=0;$i -lt 5;$i++){
  try {
    $gh = Invoke-RestMethod "$GatewayBase/health"
    if($gh.ok -eq $true){ $gwOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
Assert-True "Gateway health" $gwOk

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

$phone = "+550000000"
$eid = [guid]::NewGuid().ToString()
$evId = [guid]::NewGuid().ToString()
$trId = [guid]::NewGuid().ToString()

Invoke-RestMethod -Method Post "$ApiBase/entities/upsert" -Headers $authOwner -Body (@{id=$eid;type='lead';full_name='Teste';contact_phone=$phone} | ConvertTo-Json)
Invoke-RestMethod -Method Post "$ApiBase/events/upsert" -Headers $authOwner -Body (@{id=$evId;entity_id=$eid;status='scheduled';scheduled_for=$null} | ConvertTo-Json)
Invoke-RestMethod -Method Post "$ApiBase/transactions/upsert" -Headers $authOwner -Body (@{id=$trId;event_id=$evId;amount='100';type='income';status='pending'} | ConvertTo-Json)

$pull = Invoke-RestMethod "$ApiBase/mobile/sync/pull?since=1970-01-01T00:00:00+00:00" -Headers $authOwner
Assert-True "Sync pull entities" ($pull.changes.entities.Count -ge 1)
Assert-True "Sync pull events" ($pull.changes.events.Count -ge 1)
Assert-True "Sync pull transactions" ($pull.changes.transactions.Count -ge 1)

$triage = Invoke-RestMethod -Method Post "$ApiBase/ai/triage" -Headers $authOwner -Body (@{text='confirmo presença'} | ConvertTo-Json)
Assert-True "AI fallback triage" ($triage.intent -eq 'confirm')

$block = Invoke-RestMethod -Method Post "$ApiBase/ai/block-action" -Headers $authOwner -Body (@{action='confirm';text='confirmo';entity_id=$eid;event_id=$evId;source='e2e'} | ConvertTo-Json)
Assert-True "AI block action confirm" ($block.next_status -eq 'confirmed')

$envPath = "infra/.env"
$secret = Get-EnvValue $envPath "WEBHOOK_HMAC_SECRET" "change_this_secret"
$msgId = [guid]::NewGuid().ToString()
$payloadObj = @{ external_message_id=$msgId; phone=$phone; text='confirmo'; timestamp=(Get-Date).ToUniversalTime().ToString('o'); raw=@{} }
$payload = $payloadObj | ConvertTo-Json -Depth 5 -Compress
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$toSign = "$ts.$payload"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
$signature = -join ($sigBytes | ForEach-Object { $_.ToString('x2') })

$headersWebhook = @{
  "content-type" = "application/json"
  "x-webhook-timestamp" = "$ts"
  "x-webhook-signature" = $signature
}

$webhookOk = $false
$webhookStatusUpdate = $false
try {
  $inbound = Invoke-RestMethod -Method Post "$ApiBase/webhooks/whatsapp/inbound" -Headers $headersWebhook -Body $payload
  $webhookOk = ($inbound.ok -eq $true)
  $webhookStatusUpdate = ($inbound.status_updated.to -eq 'confirmed')
} catch {
  $webhookOk = $false
}
Assert-True "Webhook inbound signed" $webhookOk
Assert-True "Webhook updates event status" $webhookStatusUpdate

$sum = Invoke-RestMethod "$ApiBase/ops/inbound/summary" -Headers $authOwner
Assert-True "Inbound summary endpoint" ($sum.ok -eq $true)

$docReq = @{ kind='contract'; title='Contrato de Prestacao'; body='Cliente: Teste`nServico: Avaliacao' } | ConvertTo-Json
$doc = Invoke-RestMethod -Method Post "$ApiBase/documents/generate" -Headers $authOwner -Body $docReq
Assert-True "PDF contract generated" (![string]::IsNullOrWhiteSpace($doc.sha256))

Write-Host ""
Write-Host "TOTAL PASS: $pass" -ForegroundColor Green
Write-Host "TOTAL FAIL: $fail" -ForegroundColor Yellow
if ($fail -gt 0) {
  Write-Host "GO/NO-GO: NO-GO" -ForegroundColor Red
  exit 1
}
Write-Host "GO/NO-GO: GO" -ForegroundColor Green
