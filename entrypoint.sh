#!/bin/sh

# Wait for the database to be ready
echo "Waiting for the database to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "Database is ready."

# Run migrations
echo "Running migrations..."
npx sequelize-cli db:migrate:undo:all
npx sequelize-cli db:migrate
echo "Migrations completed."

# Wait for the kafka to be ready
echo "Waiting for Kafka to be ready..."

# Split the KAFKA_HOST and KAFKA_PORT if they are provided as a single environment variable
if [ -z "$KAFKA_HOST" ] || [ -z "$KAFKA_PORT" ]; then
  if [ -n "$KAFKA_BROKERS" ]; then
    KAFKA_HOST=$(echo "$KAFKA_BROKERS" | cut -d':' -f1)
    KAFKA_PORT=$(echo "$KAFKA_BROKERS" | cut -d':' -f2)
  else
    echo "Error: KAFKA_HOST and KAFKA_PORT are not set. Please set them in your environment variables or use KAFKA_HOST_PORT."
    exit 1
  fi
fi
# Ensure KAFKA_HOST and KAFKA_PORT are set
if [ -z "$KAFKA_HOST" ] || [ -z "$KAFKA_PORT" ]; then
  echo "Error: KAFKA_HOST and KAFKA_PORT must be set in your environment variables."
  exit 1
fi
while ! nc -z $KAFKA_HOST $KAFKA_PORT; do
  sleep 1
done
echo "Kafka is ready."

# Start the application
# Ensure the dist directory exists
if [ ! -d "dist" ]; then
  echo "Error: dist directory does not exist. Please build the application first."
  exit 1
fi

# Run the application
echo "Running the application..."
# Use node to run the compiled JavaScript files in the dist directory
# This assumes that the entry point of your application is dist/index.js
if [ ! -f "dist/index.js" ]; then
  echo "Error: dist/index.js does not exist. Please build the application first."
  exit 1
fi

# Execute the application
exec node dist/index.js