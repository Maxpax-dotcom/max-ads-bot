@echo off
chcp 65001 >nul
set PGPASSWORD=Max@2026

echo Running 001_users.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\001_users.sql"
if %ERRORLEVEL% neq 0 pause

echo Running 002_facebook_accounts.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\002_facebook_accounts.sql"
if %ERRORLEVEL% neq 0 pause

echo Running 003_ad_accounts.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\003_ad_accounts.sql"
if %ERRORLEVEL% neq 0 pause

echo Running 004_pages.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\004_pages.sql"
if %ERRORLEVEL% neq 0 pause

echo Running 005_campaigns.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\005_campaigns.sql"
if %ERRORLEVEL% neq 0 pause

echo Running 006_reports_logs.sql...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d meta_ads_bot -f "migrations\006_reports_logs.sql"
if %ERRORLEVEL% neq 0 pause

echo.
echo All migrations completed successfully!
pause