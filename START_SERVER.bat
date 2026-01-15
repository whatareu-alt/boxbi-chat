@echo off
REM Chat Application Server Startup Script
REM This script starts the Spring Boot backend server

echo ╔══════════════════════════════════════════════════════════════╗
echo ║         Chat Application - Starting Backend Server          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Set JAVA_HOME (adjust if your Java installation is different)
set JAVA_HOME=C:\Program Files\Java\jdk-21

REM Check if Java is available
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Java is not installed or not in PATH
    echo.
    echo Please install Java 21 or set JAVA_HOME correctly
    echo Current JAVA_HOME: %JAVA_HOME%
    pause
    exit /b 1
)

echo ✅ Java found:
java -version
echo.

REM Navigate to server directory
cd /d "%~dp0server-spring"

echo 🚀 Starting Spring Boot server...
echo    This may take a few moments...
echo.
echo 📝 Server will run on: http://localhost:8080
echo 🗄️  Database console: http://localhost:8080/h2-console
echo.
echo ⚠️  Keep this window open while using the chat application
echo    Press Ctrl+C to stop the server
echo.
echo ════════════════════════════════════════════════════════════════
echo.

REM Start the server
call mvnw.cmd spring-boot:run

REM If server stops
echo.
echo ════════════════════════════════════════════════════════════════
echo Server has stopped.
pause
