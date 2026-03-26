@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Checking dependencies...
npm install

echo Starting Crypto Kline Frontend...
npm start
