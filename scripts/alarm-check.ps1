# Alarm reliability check for every phone connected over adb.
#
# For each phone it reports: whether Android has KindRise's next alarm queued,
# the permissions the alarm needs, battery restrictions, and (with -Doze)
# whether the alarm survives deep sleep. Read-only except -Doze, which puts the
# phone into deep sleep for a moment and then wakes it again.
#
#   powershell -File scripts\alarm-check.ps1            # quick check
#   powershell -File scripts\alarm-check.ps1 -Doze      # also simulate deep sleep
param(
  [switch]$Doze,
  [string]$Package = 'app.kindrise'
)

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { $adb = Join-Path $env:USERPROFILE 'platform-tools\adb.exe' }

$devices = (& $adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' } | ForEach-Object { ($_ -split '\t')[0] }
if (-not $devices) { Write-Host 'No phone connected. Plug one in and allow USB debugging.'; exit 1 }

function Check($ok, $label, $detail) {
  $mark = if ($ok) { 'OK  ' } else { 'FIX ' }
  Write-Host ("  {0} {1}{2}" -f $mark, $label, $(if ($detail) { " ($detail)" } else { '' }))
}

foreach ($d in $devices) {
  $a = { param($cmd) & $adb -s $d shell $cmd 2>$null }
  $brand = (& $a 'getprop ro.product.brand').Trim()
  $model = (& $a 'getprop ro.product.model').Trim()
  $sdk = (& $a 'getprop ro.build.version.sdk').Trim()
  Write-Host "`n== $brand $model (Android API $sdk, $d)"

  $installed = (& $a "pm list packages $Package") -match $Package
  Check $installed 'KindRise installed'
  if (-not $installed) { continue }

  $alarms = (& $a 'dumpsys alarm') -join "`n"
  $queued = $alarms -match [regex]::Escape($Package)
  $clock = [regex]::Match($alarms, 'AlarmClock[^\n]*' + [regex]::Escape($Package)).Success
  Check $queued 'An alarm is queued with Android' $(if ($clock) { 'alarm clock type' } else { '' })

  $exact = (& $a "appops get $Package SCHEDULE_EXACT_ALARM") -join ' '
  $useExact = (& $a "dumpsys package $Package") -match 'USE_EXACT_ALARM: granted=true'
  Check ($useExact -or $exact -match 'allow') 'Exact alarms allowed'

  $fsi = (& $a "appops get $Package USE_FULL_SCREEN_INTENT") -join ' '
  Check ($fsi -notmatch 'deny|ignore') 'Full-screen alarm allowed' $fsi.Trim()

  $notif = (& $a "dumpsys notification") -join "`n"
  $blocked = $notif -match ('AppSettings: ' + [regex]::Escape($Package) + '.*importance=0')
  Check (-not $blocked) 'Notifications on'

  $bucket = (& $a "am get-standby-bucket $Package").Trim()
  Check ([int]($bucket -replace '\D', '0') -le 20) 'Standby bucket' "$bucket (10 active, 20 working set, 30+ restricted)"

  $whitelist = (& $a 'dumpsys deviceidle whitelist') -join ' '
  Check ($whitelist -match $Package) 'Battery: not optimised' $(if ($whitelist -match $Package) { '' } else { 'still optimised; fine for alarm-clock alarms, but brand battery savers may still kill it' })

  $overlay = (& $a "appops get $Package SYSTEM_ALERT_WINDOW") -join ' '
  if ($brand -match 'vivo|iqoo|xiaomi|redmi|poco|oppo|realme|oneplus') {
    Check ($overlay -match 'allow') 'Display over other apps (needed on this brand)'
  }

  if ($Doze) {
    Write-Host '  ...  Simulating deep sleep (Doze)'
    & $a 'dumpsys battery unplug' | Out-Null
    & $a 'dumpsys deviceidle force-idle' | Out-Null
    $after = (& $a 'dumpsys alarm') -join "`n"
    Check ($after -match [regex]::Escape($Package)) 'Alarm still queued in deep sleep'
    & $a 'dumpsys deviceidle unforce' | Out-Null
    & $a 'dumpsys battery reset' | Out-Null
    Write-Host '  ...  Phone woken again'
  }
}
