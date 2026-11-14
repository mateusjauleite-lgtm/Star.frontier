$ErrorActionPreference = "Stop"

$expectedEngineMajor = 5
$expectedEngineMinor = 8

function Require-Directory([string]$Name, [string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Required environment variable $Name is empty."
    }
    if (!(Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Name points to a missing directory: $Path"
    }
    Write-Host "$Name = $Path"
}

if ([string]::IsNullOrWhiteSpace($env:UE_ROOT)) {
    throw "Set UE_ROOT to the root directory of Unreal Engine 5.8."
}

$uat = Join-Path $env:UE_ROOT "Engine/Build/BatchFiles/RunUAT.bat"
$ubt = Join-Path $env:UE_ROOT "Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll"
$buildVersion = Join-Path $env:UE_ROOT "Engine/Build/Build.version"

if (!(Test-Path -LiteralPath $uat -PathType Leaf)) {
    throw "Unreal Automation Tool was not found: $uat"
}
if (!(Test-Path -LiteralPath $ubt -PathType Leaf)) {
    throw "UnrealBuildTool was not found: $ubt"
}
if (!(Test-Path -LiteralPath $buildVersion -PathType Leaf)) {
    throw "Unreal Engine Build.version was not found: $buildVersion"
}

$version = Get-Content -LiteralPath $buildVersion -Raw | ConvertFrom-Json
$engineMajor = [int]$version.MajorVersion
$engineMinor = [int]$version.MinorVersion
Write-Host "Unreal Engine version: $engineMajor.$engineMinor-CL-$($version.Changelist)"

if ($engineMajor -ne $expectedEngineMajor -or $engineMinor -ne $expectedEngineMinor) {
    throw "Star Frontier is pinned to Unreal Engine $expectedEngineMajor.$expectedEngineMinor; found $engineMajor.$engineMinor at UE_ROOT."
}

Require-Directory "ANDROID_HOME" $env:ANDROID_HOME
Require-Directory "NDKROOT" $env:NDKROOT
Require-Directory "JAVA_HOME" $env:JAVA_HOME

$java = Join-Path $env:JAVA_HOME "bin/java.exe"
if (!(Test-Path -LiteralPath $java -PathType Leaf)) {
    throw "JAVA_HOME does not contain bin/java.exe."
}
& $java -version
if ($LASTEXITCODE -ne 0) {
    throw "Java runtime check failed."
}

$adb = Join-Path $env:ANDROID_HOME "platform-tools/adb.exe"
if (!(Test-Path -LiteralPath $adb -PathType Leaf)) {
    throw "Android platform-tools/adb.exe is missing from ANDROID_HOME."
}
& $adb version
if ($LASTEXITCODE -ne 0) {
    throw "Android adb check failed."
}

$ndkProperties = Join-Path $env:NDKROOT "source.properties"
if (!(Test-Path -LiteralPath $ndkProperties -PathType Leaf)) {
    throw "NDKROOT does not contain source.properties."
}
$ndkRevision = Select-String -LiteralPath $ndkProperties -Pattern '^Pkg.Revision\s*=\s*(.+)$'
if (!$ndkRevision) {
    throw "Could not read the Android NDK revision from source.properties."
}
Write-Host "Android NDK revision: $($ndkRevision.Matches[0].Groups[1].Value)"

$project = "UE5/StarFrontier.uproject"
$startupMap = "UE5/Content/StarFrontier/Maps/L_StarFrontier_Main.umap"
if (!(Test-Path -LiteralPath $project -PathType Leaf)) {
    throw "UE5 project descriptor is missing: $project"
}
if (!(Test-Path -LiteralPath $startupMap -PathType Leaf)) {
    throw "Startup map is missing. Generate and save it with UE5/Tools/EditorPython/create_main_startup_map.py before packaging."
}

Write-Host "UE 5.8 runner prerequisites passed. Confirm the Android SDK/NDK/JDK revisions with UE 5.8 Turnkey before running BuildCookRun."
