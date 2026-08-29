# Flutter Installation Script for SIH Project
Write-Host "=== Flutter Setup for Societal Innovation Portal ===" -ForegroundColor Cyan

$FlutterPath = "C:\APPS\Flutter"
$FlutterBin = "$FlutterPath\bin\flutter.bat"
$ZipPath = "$env:USERPROFILE\Downloads\flutter_windows_3.24.5-stable.zip"

# Download Flutter if not present
if (-not (Test-Path $FlutterBin)) {
    Write-Host "[1/4] Downloading Flutter SDK..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.5-stable.zip" -OutFile $ZipPath
    Write-Host "      Download complete." -ForegroundColor Green

    Write-Host "[2/4] Extracting Flutter..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath C:\APPS -Force
    Write-Host "      Extraction complete." -ForegroundColor Green

    Write-Host "[3/4] Moving Flutter to C:\APPS\Flutter..." -ForegroundColor Yellow
    Move-Item -Path C:\APPS\flutter -Destination $FlutterPath -Force
    Write-Host "      Moving complete." -ForegroundColor Green
}

# Add to user PATH if not already present
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $CurrentPath.Contains("$FlutterPath\bin")) {
    Write-Host "[4/4] Adding Flutter to PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$FlutterPath\bin", "User")
    Write-Host "      PATH updated. Please restart your terminal." -ForegroundColor Green
} else {
    Write-Host "      Flutter is already in PATH." -ForegroundColor Green
}

# Verify installation
Write-Host ""
Write-Host "Running flutter doctor..." -ForegroundColor Cyan
& "$FlutterBin" doctor

Write-Host ""
Write-Host "=== Flutter Setup Complete ===" -ForegroundColor Green
