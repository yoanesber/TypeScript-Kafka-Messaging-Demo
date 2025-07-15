# Message Processor Service (Node.js + TypeScript + KafkaJS)

A scalable message processing microservice built with **Node.js**, **TypeScript**, **Express**, **KafkaJS**, and **PostgreSQL** (via **Sequelize**).  

This service provides RESTful APIs to POST bulk messages and GET message history, and processes incoming Kafka messages efficiently using KafkaJS's `eachBatch` method for precise control and reliability.

This project is designed to handle high-throughput message processing with idempotency guarantees, ensuring that messages are processed exactly once, even in the face of retries or failures.

## ✨ Features

- ✅ **REST API**
  - `POST` /api/v1/messages/bulk – Create messages in bulk.
  - `GET` /api/v1/messages – Retrieve stored messages.
  
- ⚙️ **Kafka Consumer with `eachBatch`**
  - Uses KafkaJS's `eachBatch` for **manual offset control**, **batch-level processing**, and **idempotent message delivery**.
  - Custom offset resolution and heartbeat handling to prevent duplicate processing or consumer group rebalancing.

- 💾 **PostgreSQL Integration**
  - Sequelize ORM used to manage `messages` table.
  - Tracks message status (e.g., `sent`, `delivered`) to avoid reprocessing.

- 🛡️ **Robustness**
  - Graceful handling of invalid or duplicate messages.
  - Logs and skips problematic entries without crashing.
  - Manual commit ensures only successful messages are marked as consumed.

---

## 🔁 Kafka Consumption Strategy (`eachBatch`)

This service uses `eachBatch` instead of the default `eachMessage` for more control:

- Manual offset commit (`autoCommit: false`)
- Fine-grained offset resolution using `resolveOffset(offset)`
- Heartbeat signals are explicitly triggered to maintain consumer liveness
- Batch-level retries, skip logic, and error handling
- Enables **idempotent** and **replayable** processing logic

```ts
await consumer.run({
  autoCommit: false,
  eachBatchAutoResolve: false,
  eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
    await heartbeat();
    for (const message of batch.messages) {
      // validate, process, resolveOffset, heartbeat
    }
    await commitOffsetsIfNecessary();
  }
});
```

---

## 🔁 Flow

In this system, messages created via the API are initially stored in the database with the status `sent`.

The **Kafka consumer** is responsible for processing these messages asynchronously by listening to the Kafka `messaging` topic. Once a message is successfully consumed and processed (e.g., validated, persisted, or handed off to downstream services), the consumer updates its status to `delivered`.

Below is the high-level flow describing how the **Message API** and **Kafka Consumer** work together to reliably process and update message statuses:

```text
┌──────────────────────────────────────────────┐
│         [1] Client Sends Bulk Messages       │
│----------------------------------------------│
│ - POST /api/v1/messages/bulk                 │
│ - Body: [{ sender, receiver, content }, ...] │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│     [2] API Saves Messages as `sent`         │
│----------------------------------------------│
│ - Stores each message with status = "sent"   │
│ - Publishes message to Kafka topic           │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│     [3] Kafka Producer Sends to Broker       │
│----------------------------------------------│
│ - Topic: messaging                           │
│ - Partitions used for scalability            │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│     [4] Kafka Consumer Triggers Batch        │
│----------------------------------------------│
│ - Consumes via `eachBatch` function          │
│ - Disables autoCommit for full control       │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│     [5] Batch Processor (eachBatch)          │
│----------------------------------------------│
│ For each message:                            │
│ - Validate message shape & idempotency       │
│ - Check if already delivered (skip if true)  │
│ - Update message status to "delivered"       │
│ - Call resolveOffset(message.offset)         │
│ - Call heartbeat() to keep alive             │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│     [6] Commit Offsets Manually              │
│----------------------------------------------│
│ - After successful batch, commit offsets     │
│ - Prevents reprocessing on restart/crash     │
└──────────────────────────────────────────────┘
```

---


## 🤖 Tech Stack

This project utilizes a modern **Node.js-based** stack to implement a scalable Kafka-powered message processing system.

| **Component**       | **Description**                                                                                       |
|---------------------|-------------------------------------------------------------------------------------------------------|
| Language            | `TypeScript` — statically typed superset of JavaScript for safer and maintainable development         |
| Runtime             | `Node.js` — JavaScript runtime built on Chrome’s V8 engine                                            |
| Web Framework       | `Express.js` — minimalist and flexible web application framework                                      |
| Kafka Client        | `KafkaJS` — modern Apache Kafka client for Node.js with native support for batch processing           |
| ORM                 | `Sequelize` — promise-based Node.js ORM for PostgreSQL and other dialects                             |
| Database            | `PostgreSQL` — robust open-source relational database                                                 |
| Validation          | `Zod` — TypeScript-first schema declaration and runtime validation                                    |
| Logging             | `winston` — versatile logging library with support for structured logs                                |
| Containerization    | `Docker` — containerizes the app, Kafka, and PostgreSQL for consistent dev & deployment environments  |
| Migration & Seeding | `Sequelize CLI` — handles DB schema migration and initial data population                             |


---

## 🧱 Architecture Overview

The project follows a modular and layered folder structure for maintainability, scalability, and separation of concerns. Below is a high-level overview of the folder architecture:

```
📁node-kafka-messaging-demo/
├── 📁docker/
│   ├── 📁app/                # Dockerfile and setup for Node.js app container
│   └── 📁postgres/           # PostgreSQL Docker setup with init scripts or volumes
├── 📁logs/                   # Directory for application and HTTP logs
├── 📁migrations/             # Sequelize migrations
├── 📁src/                    # Application source code
│   ├── 📁config/             # Configuration files (DB, Kafka, environment, Sequelize)
│   ├── 📁controllers/        # Express route handlers, business logic endpoints
│   ├── 📁dtos/               # Data Transfer Objects for validation and typing
│   ├── 📁exceptions/         # Custom error classes for centralized error handling
│   ├── 📁kafka-consumers/    # Kafka consumer logic using KafkaJS with eachBatch processing for efficient message handling
│   ├── 📁middlewares/        # Express middlewares (security, logging, rate limiters, etc.)
│   ├── 📁models/             # Sequelize models representing DB entitiesx
│   ├── 📁routes/             # API route definitions and registration
│   ├── 📁services/           # Business logic and service layer between controllers and models
│   └── 📁utils/              # Utility functions (e.g., logger)
├── .env                    # Environment variables for configuration (DB credentials, Redis, Idempotency settings)
├── .sequelizerc            # Sequelize CLI configuration
├── entrypoint.sh           # Script executed at container startup (wait-for-db, run migrations, start app)
├── package.json            # Node.js project metadata and scripts
├── sequelize.config.js     # Wrapper to load TypeScript Sequelize config via ts-node
├── tsconfig.json           # TypeScript compiler configuration
└── README.md               # Project documentation
```

---

## 🛠️ Installation & Setup  

Follow the instructions below to get the project up and running in your local development environment. You may run it natively or via Docker depending on your preference.  

### ✅ Prerequisites

Make sure the following tools are installed on your system:

| **Tool**                                                    | **Description**                                    |
|-------------------------------------------------------------|----------------------------------------------------|
| [Node.js](https://nodejs.org/)                              | JavaScript runtime environment (v20+)              |
| [npm](https://www.npmjs.com/)                               | Node.js package manager (bundled with Node.js)     |
| [Make](https://www.gnu.org/software/make/)                  | Build automation tool (`make`)                     |
| [PostgreSQL](https://www.postgresql.org/)                   | Relational database system (v14+)                  |
| [Kafka](https://kafka.apache.org/)                          | Distributed event streaming platform (v2.8+)       |
| [Docker](https://www.docker.com/)                           | Containerization platform (optional)               |

### 🔁 Clone the Project  

Clone the repository:  

```bash
git clone https://github.com/yoanesber/TypeScript-Kafka-Messaging-Demo.git
cd TypeScript-Kafka-Messaging-Demo
```

### ⚙️ Configure `.env` File  

Set up your **database** and **Redis** configurations by creating a `.env` file in the project root directory:

```properties
# Application Configuration
PORT=4000
# development, production, test
NODE_ENV=development

# Logging Configuration
LOG_LEVEL=info
LOG_DIRECTORY=../../logs

# Postgre Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=P@ssw0rd
DB_NAME=nodejs_demo
DB_DIALECT=postgres

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_TOPICS=messaging
KAFKA_GROUP_ID=messaging-group
KAFKA_ALLOW_AUTO_TOPIC_CREATION=false

## Kafka Producer Retry Configuration
# number of retries for failed messages
KAFKA_PRODUCER_RETRY_MAX_ATTEMPTS=5
# initial time to wait before first retry
KAFKA_PRODUCER_RETRY_INITIAL_TIME_MS=100
# maximum time to wait for a message to be retried
# this is the total time for all retries
# e.g. if initial time is 100ms and max time is 30000ms
KAFKA_PRODUCER_RETRY_MAX_TIME_MS=30000
# the additional percentage of delay time for each retry
# e.g. if initial time is 100ms and factor is 0.2,
# the delay times will be 100ms, 120ms, 144ms, 172.8ms, etc.
KAFKA_PRODUCER_RETRY_FACTOR=0.2
# use for exponential delay between retries
# e.g. if initial time is 100ms and multiplier is 1.5,
# the delay times will be 100ms, 150ms, 225ms, 337.5ms, etc.
KAFKA_PRODUCER_RETRY_MULTIPLIER=1

## Kafka Producer Idempotence Configuration
# to ensure exactly-once semantics
# kafka will not store duplicate messages if the producer tries to send the same message multiple times (retry)
# this is useful for idempotent producers
KAFKA_PRODUCER_ENABLE_IDEMPOTENCE=true

## Kafka Producer Transaction Configuration
# to provide a unique identifier for the producer
# all `send()` performed in a transaction can be:
# - committed together
# - aborted together
KAFKA_PRODUCER_TRANSACTIONAL_ID=my-transactional-id
# the maximum duration Kafka will wait before considering a transaction as failed
# if the producer does not commit or abort the transaction within this time, it will be aborted
KAFKA_PRODUCER_TRANSACTION_TIMEOUT_MS=60000
# determine how many requests can be sent in parallel
# this is useful for high throughput applications
# e.g. if set to 1, the producer will wait for the response of the previous request before sending the next one
# this is useful for ensuring the order of messages in a partition
KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS=1

## Kafka Consumer Configuration
# The maximum amount of time (in milliseconds) the broker will wait for a heartbeat from the consumer before considering it dead and triggering a rebalance.
# In this case, if no heartbeat is received within 10 seconds, the consumer is considered disconnected.
KAFKA_CONSUMER_SESSION_TIMEOUT_MS=10000
# The interval (in milliseconds) at which the consumer sends heartbeats to the Kafka broker to indicate it is still alive.
# Here, the consumer will send a heartbeat every 3 seconds.
KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS=3000
# The maximum amount of data (in bytes) fetched from each partition in a single request.
# Set to 1 MB here, it helps limit how much data is retrieved per partition to avoid memory overuse.
KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION=1048576
# The minimum amount of data (in bytes) the broker should have before responding to a fetch request.
# A low value (1 byte) means the broker will respond as soon as any message is available.
KAFKA_CONSUMER_MIN_BYTES=1
# The maximum total size (in bytes) of data that the consumer will fetch in one request across all partitions.
# This is 5 MB, acting as a hard limit to avoid fetching too much at once.
KAFKA_CONSUMER_MAX_BYTES=5242880
# The maximum time (in milliseconds) the broker will wait before responding to a fetch request if the minBytes condition hasn't been met.
# Even if the broker doesn't have enough data, it will respond after 5 seconds.
KAFKA_CONSUMER_MAX_WAIT_TIME_MS=5000
# Determines whether the consumer should read messages that are part of transactions that have not yet been committed.
# false means the consumer will only read messages that are part of completed (committed) transactions — ensures consistency.
KAFKA_CONSUMER_READ_UNCOMMITTED=false

## Kafka Consumer Retry Configuration
# The maximum number of retry attempts the consumer will make if a recoverable error occurs.
# In this case, the consumer will try up to 5 times before giving up.
KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS=5
# The initial delay (in milliseconds) before the first retry attempt.
# Here, the consumer will wait 1 second before the first retry.
KAFKA_CONSUMER_RETRY_INITIAL_TIME_MS=1000
# The maximum total amount of time (in milliseconds) to keep retrying.
# If all retries exceed 30 seconds in total, the retry will stop regardless of the number of attempts.
KAFKA_CONSUMER_RETRY_MAX_TIME_MS=30000
# The exponential backoff factor used to increase the delay between each retry attempt.
# Each delay = previous delay × (1 + factor).
# A factor of 0.2 increases the delay gradually, e.g., 1000ms → 1200ms → 1440ms, etc.
KAFKA_CONSUMER_RETRY_FACTOR=0.2
# A multiplier applied to each retry delay.
# A value of 1 means the delay isn't additionally scaled — it's neutral.
# You can increase this if you want to slow down the retry rate globally.
KAFKA_CONSUMER_RETRY_MULTIPLIER=1
```

### 👤 Create Dedicated PostgreSQL User (Recommended)

For security reasons, it's recommended to avoid using the default postgres superuser. Use the following SQL script to create a dedicated user (`appuser`) and assign permissions:

```sql
-- Create appuser and database
CREATE USER appuser WITH PASSWORD 'app@123';

-- Allow user to connect to database
GRANT CONNECT, TEMP, CREATE ON DATABASE nodejs_demo TO appuser;

-- Grant permissions on public schema
GRANT USAGE, CREATE ON SCHEMA public TO appuser;

-- Grant all permissions on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appuser;

-- Grant all permissions on sequences (if using SERIAL/BIGSERIAL ids)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO appuser;

-- Ensure future tables/sequences will be accessible too
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO appuser;

-- Ensure future sequences will be accessible too
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO appuser;
```

Update your `.env` accordingly:
```properties
DB_USER=appuser
DB_PASS=app@123
```


### 📬 Create Kafka Topic `messaging`

To ensure the system works correctly, you need to create a Kafka topic named `messaging`. You can use the Kafka CLI inside the broker container or host system (depending on your setup). Here's how to create the topic manually:

```bash
# Create a Kafka topic named "messaging"
bin/kafka-topics.sh --create \
  --topic messaging \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 1
```

⚠️ Note: Adjust `--bootstrap-server`, `--replication-factor`, and `--partitions` based on your production environment and Kafka cluster configuration.

To verify that the topic was created:

```bash
# List all topics
bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

If you're running Kafka inside Docker, prepend docker exec like so:

```bash
docker exec -it kafka-broker \
  kafka-topics.sh --create \
  --topic messaging \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 1
```

Once created, your application will be able to send and consume messages using the `messaging` topic.

---


## 🚀 Running the Application  

This section provides step-by-step instructions to run the application either **locally** or via **Docker containers**.

- **Notes**:  
  - All commands are defined in the `Makefile`.
  - To run using `make`, ensure that `make` is installed on your system.
  - To run the application in containers, make sure `Docker` is installed and running.
  - Ensure you have `NodeJs` and `npm` installed on your system

### 📦 Install Dependencies

Make sure all dependencies are properly installed:  

```bash
make install
```

### 🔧 Run Locally (Non-containerized)

Ensure PostgreSQL and Redis are running locally, then:

```bash
make dev
```

This command will run the application in development mode, listening on port `4000` by default.

### Run Migrations

To create the database schema, run:

```bash
make refresh-migrate
```

This will apply all pending migrations to your PostgreSQL database.

### 🐳 Run Using Docker

To build and run all services (PostgreSQL, Redis, and NodeJs app):

```bash
make docker-up
```

To stop and remove all containers:

```bash
make docker-down
```

- **Notes**:  
  - Before running the application inside Docker, make sure to update your environment variables `.env`
    - Change `DB_HOST=localhost` to `DB_HOST=node-kafka-messaging-postgres`.
    - Change `KAFKA_HOST=localhost` to `KAFKA_HOST=node-kafka-server`.

### 🟢 Application is Running

Now your application is accessible at:
```bash
http://localhost:4000
```

---

## 🧪 Testing Scenarios  

The following test cases ensure reliability, message delivery, and idempotency across the API and Kafka consumer:

### API Testing

#### Create Single Message with Valid Data

To create a single message, you can use the following `curl` command:

```bash
curl -X POST http://localhost:4000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
        "content": "Hello, how are you?",
        "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
        "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
    }'
```

**Expected Response**: Get `200 OK` with a JSON response containing the created message details.

```json
{
    "message": "Message created successfully",
    "error": null,
    "data": {
        "id": "86e90b85-b0b3-4427-aa78-c06719c8ecd0",
        "content": "Hello, how are you?",
        "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
        "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0",
        "status": "sent",
        "updatedAt": "2025-07-15T16:24:13.265Z",
        "createdAt": "2025-07-15T16:24:13.265Z"
    },
    "path": "/api/messages",
    "timestamp": "2025-07-15T16:24:13.316Z"
}
```

#### Create Bulk Messages with Valid Data

To create multiple messages in bulk, you can use the following `curl` command:

```bash
curl -X POST http://localhost:4000/api/messages/bulk \
  -H "Content-Type: application/json" \
  -d '[
      {
          "content": "Hey, are we still meeting later?",
          "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
          "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
      },
      {
          "content": "Don't forget to send the report.",
          "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
          "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
      },
      {
          "content": "Happy birthday! Hope you have a great day.",
          "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
          "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
      },
      {
          "content": "Can you review my PR when you have time?",
          "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
          "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
      },
      {
          "content": "Lunch is ready if you're hungry!",
          "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
          "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
      }
  ]'
```

**Expected Response**: Get `200 OK` with a JSON response containing the details of all created messages.

```json
{
    "message": "Messages created successfully",
    "error": null,
    "data": [
        {
            "id": "86e90b85-b0b3-4427-aa78-c06719c8ecd0",
            "content": "Hey, are we still meeting later?",
            "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
            "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0",
            "status": "sent",
            "updatedAt": "2025-07-15T16:24:13.265Z",
            "createdAt": "2025-07-15T16:24:13.265Z"
        },
        ...
    ]
    "path": "/api/messages/bulk",
    "timestamp": "2025-07-15T16:26:19.947Z"
}
```

#### Retrieve All Messages

To retrieve all messages, you can use the following `curl` command:

```bash
curl -X GET http://localhost:4000/api/messages?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Expected Response**: Get `200 OK` with a JSON response containing an array of messages.

```json
{
    "message": "Messages retrieved successfully",
    "error": null,
    "data": {
        "count": 5,
        "rows": [
            {
                "id": "86e90b85-b0b3-4427-aa78-c06719c8ecd0",
                "content": "Hey, are we still meeting later?",
                "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
                "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0",
                "status": "sent",
                "updatedAt": "2025-07-15T16:24:13.265Z",
                "createdAt": "2025-07-15T16:24:13.265Z"
            },
            ...
        ]
    },
    "path": "/api/messages",
    "timestamp": "2025-07-15T16:26:19.947Z"
}
```

#### Retrieve Message by ID

To retrieve a specific message by its ID, you can use the following `curl` command:

```bash
curl -X GET http://localhost:4000/api/messages/113405d3-7ab8-453b-a6f7-fd376d5155aa
```

**Expected Response**: Get `200 OK` with a JSON response containing the message details.

```json
{
    "message": "Message retrieved successfully",
    "error": null,
    "data": {
        "id": "113405d3-7ab8-453b-a6f7-fd376d5155aa",
        "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
        "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0",
        "content": "Don't forget to send the report.",
        "status": "delivered",
        "createdAt": "2025-07-15T16:26:19.925Z",
        "updatedAt": "2025-07-15T16:26:19.953Z"
    },
    "path": "/api/messages/113405d3-7ab8-453b-a6f7-fd376d5155aa",
    "timestamp": "2025-07-15T16:28:41.448Z"
}
```

#### Create Message with Invalid Data

To test validation, you can send a message with invalid data:

```bash
curl -X POST http://localhost:4000/api/messages \
-H "Content-Type: application/json" \
-d '{
    "content": "",
    "sender": "invalid-sender-id",
    "receiver": "invalid-receiver-id"
}'
```

**Expected Response**: Get `400 Bad Request` with a JSON response containing validation errors.

```json
{
    "message": "Validation error",
    "error": {
        "content": [
            "Content is required"
        ],
        "sender": [
            "Invalid sender ID format"
        ],
        "receiver": [
            "Invalid receiver ID format"
        ]
    },
    "data": null,
    "path": "/api/messages",
    "timestamp": "2025-07-15T16:29:40.996Z"
}
```

### Kafka Consumer Testing

#### Verify Kafka Consumer Processing

To verify that the Kafka consumer is processing messages correctly, you can use the following steps:

1. **Produce a Test Message**: Send a test message to the Kafka topic that the consumer is listening to.

```bash
curl -X POST http://localhost:4000/api/messages \
-H "Content-Type: application/json" \
-d '{
    "content": "Test message",
    "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
    "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0"
}'
```

2. **Check Consumer Logs**: Monitor the logs of the Kafka consumer service to ensure that it has received and processed the test message.

3. **Verify Message Processing**: Check the database or any other storage used by the consumer to verify that the message has been processed and stored correctly.

```bash
curl -X GET http://localhost:4000/api/messages?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Expected Response**: Get `200 OK` with a JSON response containing the processed message.

```json
{
    "message": "Messages retrieved successfully",
    "error": null,
    "data": [
        {
            "id": "c4fb9144-ce44-425a-9f8e-cbbdd8c40c79",
            "sender": "8c5b6fa2-7a3d-4a2a-97c4-e5d8a5f6e4bb",
            "receiver": "92a3a0fe-f42b-4196-b41d-84295bdf2cf0",
            "content": "Test message",
            "status": "delivered",
            "createdAt": "2025-07-15T16:31:11.613Z",
            "updatedAt": "2025-07-15T16:31:11.626Z"
        }
    ],
    "path": "/api/messages",
    "timestamp": "2025-07-15T16:26:19.947Z"
}
```

