@echo off
:: Change directory to where this batch file is located
cd /d "%~dp0"

set PORT=3000
set APP_DIR=%~dp0apps\katrina-beyond
set PNPM_VERSION=12.8.1

:: Check whether something is already listening on the port
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 (
    echo Server already running on port %PORT%.
    goto launch
)

:: ---- Prerequisites: Node.js and pnpm ----

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Installing Node.js LTS...
    where winget >nul 2>&1
    if errorlevel 1 (
        echo winget is not available. Please install Node.js LTS from https://nodejs.org and run this again.
        pause
        exit /b 1
    )
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    :: The installer updates PATH for new windows only, so add it for this one
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    where node >nul 2>&1
    if errorlevel 1 (
        echo Node.js installation failed. Please install Node.js LTS from https://nodejs.org and run this again.
        pause
        exit /b 1
    )
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo pnpm not found. Installing pnpm %PNPM_VERSION%...
    call npm install -g pnpm@%PNPM_VERSION%
    :: Global npm packages live in %AppData%\npm
    set "PATH=%AppData%\npm;%PATH%"
    where pnpm >nul 2>&1
    if errorlevel 1 (
        echo pnpm installation failed.
        pause
        exit /b 1
    )
)

:: ---- Dependencies and build ----

:: Install dependencies if they haven't been installed yet
:: Only the website and what it depends on are installed
set NEED_INSTALL=0
if not exist "%~dp0node_modules" set NEED_INSTALL=1
if not exist "%APP_DIR%\node_modules" set NEED_INSTALL=1
if %NEED_INSTALL%==1 (
    echo node_modules not found. Installing dependencies...
    pushd "%~dp0"
    call pnpm install --filter katrina-beyond...
    if errorlevel 1 (
        popd
        echo Dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

:: Build once if there is no production build yet
if not exist "%APP_DIR%\.next\BUILD_ID" (
    echo No production build found. Building...
    pushd "%APP_DIR%"
    call pnpm build
    if errorlevel 1 (
        popd
        echo Build failed.
        pause
        exit /b 1
    )
    popd
)

:: Start the Next.js server in its own minimized window
echo Starting server...
start "Katrina Beyond Server" /min cmd /c "cd /d "%APP_DIR%" && pnpm start -p %PORT%"

:: Wait up to 60 seconds for the server to start listening
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto launch
set /a tries+=1
if %tries% lss 60 goto wait
echo Server failed to start within 60 seconds.
pause
exit /b 1

:launch
:: Make sure Chrome is installed
set CHROME_FOUND=0
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set CHROME_FOUND=1
reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set CHROME_FOUND=1
if %CHROME_FOUND%==0 (
    echo Google Chrome not found. Installing...
    where winget >nul 2>&1 && winget install -e --id Google.Chrome --silent --accept-package-agreements --accept-source-agreements
    reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set CHROME_FOUND=1
    reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set CHROME_FOUND=1
)

:: Launch Chrome in full-screen app mode, or the default browser as a fallback
if %CHROME_FOUND%==1 (
    start chrome --start-fullscreen --app=http://localhost:%PORT%/evacuation
) else (
    echo Could not install Chrome. Opening the default browser instead.
    start "" http://localhost:%PORT%/evacuation
)
