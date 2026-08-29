@echo off
echo === Flutter SDK Installer for SIH Project ===
echo.

set FLUTTER_URL=https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.5-stable.zip
set DOWNLOAD_PATH=%USERPROFILE%\Downloads\flutter.zip
set INSTALL_PATH=C:\APPS\Flutter

echo Step 1: Checking if Flutter is already installed...
if exist "%INSTALL_PATH%\bin\flutter.bat" (
    echo Flutter is already installed at %INSTALL_PATH%
    goto :install_complete
)

echo Step 2: Downloading Flutter SDK...
echo This will take a few minutes (~700MB)
powershell -Command "Invoke-WebRequest -Uri '%FLUTTER_URL%' -OutFile '%DOWNLOAD_PATH%'"
if errorlevel 1 (
    echo Download failed. Please download manually from:
    echo https://docs.flutter.dev/get-started/install/windows
    pause
    exit /b 1
)

echo.
echo Step 3: Extracting Flutter...
powershell -Command "Expand-Archive -Path '%DOWNLOAD_PATH%' -DestinationPath C:\APPS -Force"

echo Step 4: Moving Flutter to installation directory...
if exist "C:\APPS\flutter" (
    move "C:\APPS\flutter" "%INSTALL_PATH%"
)

echo Step 5: Adding Flutter to PATH...
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "OLDPATH=%%b"
setx PATH "%INSTALL_PATH%\bin;%OLDPATH%" >nul

echo.
echo === Installation Complete! ===
echo.
echo Please restart your terminal and run:
echo   flutter doctor
echo.
echo Step 6: Running flutter doctor...
if exist "%INSTALL_PATH%\bin\flutter.bat" (
    "%INSTALL_PATH%\bin\flutter.bat" doctor
)

:install_complete
pause
