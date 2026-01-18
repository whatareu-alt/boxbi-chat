#!/bin/sh

# If DB_HOST is provided (Render), construct the PostgreSQL JDBC URL
if [ -n "$DB_HOST" ]; then
    echo "Configuring for PostgreSQL..."
    export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Run the application
# Use exec to ensure the java process becomes PID 1 (receives signals)
exec java -Dserver.port=${PORT:-8080} -jar app.jar
