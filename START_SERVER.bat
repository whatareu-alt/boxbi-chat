@echo off
setlocal
echo Setting JAVA_HOME to C:\Program Files\Java\jdk-21
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Checking Java version...
java -version

echo Starting Spring Boot Server...
cd server-spring
call mvnw.cmd spring-boot:run
pause
