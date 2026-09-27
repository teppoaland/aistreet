@echo off
title Pimea Katu - Web Server
echo ============================================
echo   Pimea Katu - Sisäverkon Web-palvelin
echo ============================================
echo.
echo Palvelin kaynnistyy porttiin 8080...
echo.
echo Pelit loytyvat:
echo   Paikallisesti:  http://localhost:8080
echo   Sisäverkossa:   http://192.168.1.44:8080
echo.
echo Paina Ctrl+C sulkeaksesi palvelimen.
echo ============================================
echo.
python -m http.server 8080 --bind 0.0.0.0
pause