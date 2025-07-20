import "dotenv/config";
import readline from "readline";

import app from "./app";
import KafkaBatchMessageConsumer from './kafka-consumers/batch-message.consumer';
import logger from "./utils/logger.util";
import DatabaseConfig from "./config/db.config";
import { kafkaProducerConfig as KafkaProducerConfig, kafkaConsumerConfig as KafkaConsumerConfig } from "./config/kafka.config";

// Connect to the Kafka producer
try {
    KafkaProducerConfig.connect();
} catch (error) {
    logger.error(`Error initializing Kafka Producer: ${error}`);
    process.exit(1); // Exit with error
}

// Connect to the Kafka consumer
try {
    KafkaConsumerConfig.connect();
} catch (error) {
    logger.error(`Error initializing Kafka Consumer: ${error}`);
    process.exit(1); // Exit with error
}

// Connect to the database
try {
    DatabaseConfig.connect();
    logger.info("Database connected successfully");
} catch (error) {
    logger.error(`Error connecting to the database: ${error}`);
    process.exit(1); // Exit with error
}

// Start the Kafka consumer
try {
    KafkaBatchMessageConsumer.start();
    logger.info("Kafka Batch Message Consumer started successfully");
} catch (error) {
    logger.error(`Error starting Kafka Batch Message Consumer: ${error}`);
    process.exit(1); // Exit with error
}

// Start the Express server
const PORT = process.env.PORT || 3000;
let server;
try {
    server = app.listen(PORT, () => {
        logger.info(`Server running on http://localhost:${PORT}`);
    });
} catch (error) {
    logger.error(`Error starting server: ${error}`);
    process.exit(1); // Exit if server fails to start
}

// Handle Ctrl+C on Windows PowerShell
if (process.platform === "win32") {
    try {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.on("SIGINT", () => {
            rl.question("Are you sure you want to exit? (yes/no) ", (answer) => {
                if (answer.toLowerCase() === "yes") {
                    shutdown();
                } else {
                    rl.close();
                }
            });
        });
    } catch (error) {
        logger.error(`Error setting up SIGINT handler: ${error}`);
    }
}

// Graceful shutdown
const shutdown = async () => {
    logger.info("\nShutting down gracefully...");

    try {
        // 1. Close database connection
        if (await DatabaseConfig.isConnected()) {
            await DatabaseConfig.disconnect();
            logger.info("Database connection closed");
        }

        // 2. Close Kafka connections
        if (await KafkaProducerConfig.isConnected()) {
            await KafkaProducerConfig.disconnect();
            logger.info("Kafka connections closed");
        }
        if (await KafkaConsumerConfig.isConnected()) {
            await KafkaConsumerConfig.disconnect();
            logger.info("Kafka Consumer disconnected");
        }
        
        // 3. Close server
        server.close(() => {
            logger.info("Server closed");
            process.exit(0); // Exit with success
        });

        // 4. Handle any remaining requests
        setTimeout(() => {
            logger.error("Forcing shutdown after timeout");
            process.exit(1); // Exit with error
        }, 5000); // 5 seconds timeout
    } catch (err) {
        logger.error("Error closing server:", err);
        process.exit(1); // Exit with error
    }
};

// Handle termination signals
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // Heroku or other platforms
