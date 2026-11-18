# Builds a release APK on this PC (no EAS queue), signed with the same key as
# the EAS builds, so it installs over the app on the phone and keeps its data.
#
# Needs: Android Studio (for its Java and the Android SDK) and the signing key
# downloaded with `eas credentials` (credentials.json + credentials/, both
# git-ignored). Passwords are passed to apksigner through environment
# variables and never printed.
#
# Why C:\mr: the C++ build (ninja) fails on Windows' 260-character path limit
# deep inside node_modules, and the project path appears twice in those
# paths. Drive-letter tricks (subst, junctions) break because Node resolves
# the real path while Gradle doesn't. So the source is mirrored into a short
# real folder and built there; this working copy (and uncommitted edits)
# stays the source of truth, and the APK lands in .\build.
#
# Usage:  .\scripts\build-local-apk.ps1            build only
#         .\scripts\build-local-apk.ps1 -Install   build, then adb install -r
param([switch]$Install, [string]$BuildDir = 'C:\mr')

$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent

# Gradle and Kotlin daemons outlive a build. On Windows they keep jars open
# ("Unable to delete file" in the next build) and keep this script's caller
# waiting, so stop them before and after every build. Only Java processes
# whose command line names Gradle or Kotlin are touched (not Android Studio).
function Stop-BuildDaemons {
  Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
    Where-Object { $_.CommandLine -match 'GradleDaemon|gradle-launcher|KotlinCompileDaemon|kotlin-daemon|kotlin-compiler-embeddable' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:Path = "$env:JAVA_HOME\bin;C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"
$env:CI = '1'  # no interactive prompts from expo prebuild

if (-not (Test-Path (Join-Path $source 'credentials.json'))) {
  throw 'credentials.json is missing: run `npx eas-cli credentials -p android` and download it first.'
}

Write-Host "== Mirroring source to $BuildDir"
# Exclude top-level folders by full path (a bare name would also skip nested
# folders such as credentials\android). The signing key is never copied: it
# is read from the source folder below.
$exclude = 'node_modules', 'android', 'build', '.git', '.expo', 'dist', 'credentials' | ForEach-Object { Join-Path $source $_ }
robocopy $source $BuildDir /MIR /XD $exclude /XF credentials.json /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
Set-Location $BuildDir

# Reinstall packages only when the lockfile changed since the last build here.
$lockHash = (Get-FileHash package-lock.json).Hash
$stamp = 'node_modules\.lock-hash'
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
  Write-Host '== Installing packages (npm ci)'
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  Set-Content $stamp $lockHash
}

$ks = (Get-Content (Join-Path $source 'credentials.json') -Raw | ConvertFrom-Json).android.keystore
$keystoreFile = Join-Path $source $ks.keystorePath

Write-Host '== Generating the native Android project'
npx expo prebuild --platform android --clean --no-install
if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }

# Use the newest CMake in the SDK: its ninja (1.12+) handles Windows long
# paths; the default CMake 3.22's ninja 1.10 fails on react-native codegen.
# C:\Android\cmake first: CMake 3.31.6 from dl.google.com was unpacked there
# (a plain folder, visible from any terminal); the SDK's own folder is the
# fallback.
$cmake = @('C:\Android\cmake', (Join-Path $env:ANDROID_HOME 'cmake')) | Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem $_ -Directory } |
  Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
$sdkDir = $env:ANDROID_HOME -replace '\\', '\\'
$cmakeDir = $cmake.FullName -replace '\\', '\\'
Set-Content android\local.properties "sdk.dir=$sdkDir`ncmake.dir=$cmakeDir" -Encoding ascii
Write-Host "== Using CMake $($cmake.Name)"

Write-Host '== Building the release APK (first run downloads Gradle and the NDK)'
# arm64-v8a only: every current phone (including the iQOO test phone) is
# 64-bit ARM, and building one ABI is about four times faster than all four.
Stop-BuildDaemons
& .\android\gradlew.bat -p android :app:assembleRelease --console=plain -PreactNativeArchitectures=arm64-v8a
$gradleExit = $LASTEXITCODE
Stop-BuildDaemons
if ($gradleExit -ne 0) { throw 'Gradle build failed' }

$built = 'android\app\build\outputs\apk\release\app-release.apk'
$outDir = Join-Path $source 'build'
New-Item -ItemType Directory -Force $outDir | Out-Null
$sha = (git -C $source rev-parse --short HEAD).Trim()
$dirty = if (git -C $source status --porcelain) { '-dirty' } else { '' }
$out = Join-Path $outDir "morning-ritual-local-$sha$dirty.apk"

Write-Host '== Signing with the EAS key'
$buildTools = (Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') | Sort-Object Name -Descending)[0].FullName
$env:MR_KS_PASS = $ks.keystorePassword
$env:MR_KEY_PASS = $ks.keyPassword
try {
  & "$buildTools\apksigner.bat" sign --ks $keystoreFile --ks-key-alias $ks.keyAlias `
    --ks-pass env:MR_KS_PASS --key-pass env:MR_KEY_PASS --out $out $built
  if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }
} finally {
  Remove-Item env:MR_KS_PASS, env:MR_KEY_PASS -ErrorAction SilentlyContinue
}
& "$buildTools\apksigner.bat" verify --print-certs $out | Select-String 'certificate SHA-256'
Write-Host "== Built $out"

if ($Install) {
  & (Join-Path $env:USERPROFILE 'platform-tools\adb.exe') install -r $out
}
