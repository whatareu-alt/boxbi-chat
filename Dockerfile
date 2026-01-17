FROM python:3.11-alpine

WORKDIR /app

# Copy all files from current directory to /app
COPY . .

# Railway provides the PORT environment variable
# We use shell form of CMD to expand the variable
CMD sh -c "python -m http.server $PORT"
