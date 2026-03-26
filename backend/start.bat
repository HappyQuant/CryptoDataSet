@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Checking dependencies...
pipenv install

echo Starting Crypto Kline Backend Server...
pipenv run uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
