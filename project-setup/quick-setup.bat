@echo off
echo === Quick Setup - SIH Project (without Flutter) ===
echo.

echo Step 1: Creating project structure...
mkdir backend
mkdir ml-service
mkdir web
mkdir supabase\migrations
mkdir docs

echo Step 2: Creating environment file...
echo SUPABASE_URL=http://localhost:5432 > .env
echo SUPABASE_ANON_KEY=your-anon-key-here >> .env
echo SUPABASE_SERVICE_KEY=your-service-key-here >> .env
echo SUPABASE_JWT_SECRET=your-jwt-secret-here >> .env
echo. >> .env
echo NEO4J_URI=neo4j+s://da0651ee.databases.neo4j.io >> .env
echo NEO4J_USERNAME=da0651ee >> .env
echo NEO4J_PASSWORD=6hCm8FJNZJyxywF3ZyakWbaACsQUI9_XbFUNNryJCh4 >> .env
echo NEO4J_DATABASE=da0651ee >> .env

echo Step 3: Creating backend structure...
mkdir backend\src
mkdir backend\src\modules
mkdir backend\src\modules\citizen
mkdir backend\src\modules\student
mkdir backend\src\modules\government
mkdir backend\src\modules\industry
mkdir backend\src\modules\shared
mkdir backend\src\ai-gateway

echo Step 4: Creating ml-service structure...
mkdir ml-service\app
mkdir ml-service\app\triage
mkdir ml-service\app\extraction
mkdir ml-service\app\prediction

echo.
echo === Quick Setup Complete! ===
echo.
echo Next steps:
echo 1. Start Supabase: supabase start
echo 2. Setup backend: cd backend && npm init
echo 3. Setup ML service: cd ml-service && pip install -r requirements.txt
echo.
echo Note: Flutter mobile app setup requires downloading SDK (~700MB).
echo       You can add mobile support later or use the web portal first.
pause
