@echo off
setlocal

echo Starting deploy to local Docker...

where docker >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Docker not installed.
  exit /b 1
)

docker compose version >nul 2>nul
if %errorlevel% equ 0 (
  set "COMPOSE_CMD=docker compose"
) else (
  docker-compose version >nul 2>nul
  if %errorlevel% equ 0 (
    set "COMPOSE_CMD=docker-compose"
  ) else (
    echo ERROR: Neither 'docker compose' nor 'docker-compose' found.
    exit /b 1
  )
)

echo Building and starting services...
%COMPOSE_CMD% down --remove-orphans
%COMPOSE_CMD% build --no-cache
%COMPOSE_CMD% up -d

echo Waiting for services to start...
timeout /t 10 /nobreak >nul

echo Checking service status...
%COMPOSE_CMD% ps

echo Running health checks...
curl -f http://localhost:3001/api/health >nul 2>nul
if %errorlevel% equ 0 (
  echo API OK
) else (
  echo API FAILED
)

curl -f http://localhost:3001/ >nul 2>nul
if %errorlevel% equ 0 (
  echo Frontend OK
) else (
  echo Frontend FAILED
)

echo.
echo Deploy finished.
echo Frontend: http://localhost:3000
echo API: http://localhost:3001
echo Docs: http://localhost:3001/api/docs
echo.
echo Commands:
echo   %COMPOSE_CMD% logs -f [service]
echo   %COMPOSE_CMD% down
echo   %COMPOSE_CMD% restart [service]
echo   %COMPOSE_CMD% exec [service] cmd
echo.
endlocal
pause
