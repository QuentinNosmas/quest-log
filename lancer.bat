@echo off
rem Lance Quest Log sur ce PC puis ouvre le navigateur (Node.js doit etre installe).
cd /d "%~dp0"
start "" http://localhost:8777
node serveur.mjs
pause
