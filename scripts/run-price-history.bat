@echo off
echo 🚀 Starting Price History Population Script...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the correct directory
if not exist "package.json" (
    echo ❌ Please run this script from the project root directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Install dependencies if needed
echo 📦 Checking dependencies...
npm list @supabase/supabase-js >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing @supabase/supabase-js...
    npm install @supabase/supabase-js
)

npm list dotenv >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dotenv...
    npm install dotenv
)

REM Check if .env.local file exists
if not exist ".env.local" (
    echo ❌ .env.local file not found
    echo Please create a .env.local file with:
    echo NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    pause
    exit /b 1
)

echo ✅ All dependencies ready
echo.
echo 🔄 Running price history population script...
node scripts/populate-price-history.js

echo.
if %errorlevel% equ 0 (
    echo ✅ Script completed successfully!
) else (
    echo ❌ Script failed with error code %errorlevel%
)

pause