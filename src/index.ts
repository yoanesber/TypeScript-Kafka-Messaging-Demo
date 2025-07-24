import "dotenv/config";
import readline from "readline";

import app from "./app";
import DatabaseConfig from "./config/db.config";
import KafkaBatchMessageConsumer from './kafka-consumers/batch-message.consumer';
import Logger from "./utils/logger.util";
import { kafkaProducerConfig as KafkaProducerConfig, kafkaConsumerConfig as KafkaConsumerConfig } from "./config/kafka.config";

// Connect to the Kafka producer
try {
    KafkaProducerConfig.connect();
} catch (error) {
    Logger.error(`Error initializing Kafka Producer: ${error}`);
    process.exit(1); // Exit with error
}

// Connect to the Kafka consumer
try {
    KafkaConsumerConfig.connect();
} catch (error) {
    Logger.error(`Error initializing Kafka Consumer: ${error}`);
    process.exit(1); // Exit with error
}

// Connect to the database
try {
    DatabaseConfig.connect();
    Logger.info("Database connected successfully");
} catch (error) {
    Logger.error(`Error connecting to the database: ${error}`);
    process.exit(1); // Exit with error
}

// Start the Kafka consumer
try {
    KafkaBatchMessageConsumer.start();
    Logger.info("Kafka Batch Message Consumer started successfully");
} catch (error) {
    Logger.error(`Error starting Kafka Batch Message Consumer: ${error}`);
    process.exit(1); // Exit with error
}

// Start the Express server
const PORT = process.env.PORT || 3000;
let server;
try {
    server = app.listen(PORT, () => {
        Logger.info(`Server running on http://localhost:${PORT}`);
    });
} catch (error) {
    Logger.error(`Error starting server: ${error}`);
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
        Logger.error(`Error setting up SIGINT handler: ${error}`);
    }
}

// Graceful shutdown
const shutdown = async () => {
    Logger.info("\nShutting down gracefully...");

    try {
        // 1. Close database connection
        if (await DatabaseConfig.isConnected()) {
            await DatabaseConfig.disconnect();
            Logger.info("Database connection closed");
        }

        // 2. Close Kafka connections
        if (await KafkaProducerConfig.isConnected()) {
            await KafkaProducerConfig.disconnect();
            Logger.info("Kafka connections closed");
        }
        if (await KafkaConsumerConfig.isConnected()) {
            await KafkaConsumerConfig.disconnect();
            Logger.info("Kafka Consumer disconnected");
        }
        
        // 3. Close server
        server.close(() => {
            Logger.info("Server closed");
            process.exit(0); // Exit with success
        });

        // 4. Handle any remaining requests
        setTimeout(() => {
            Logger.error("Forcing shutdown after timeout");
            process.exit(1); // Exit with error
        }, 5000); // 5 seconds timeout
    } catch (err) {
        Logger.error("Error closing server:", err);
        process.exit(1); // Exit with error
    }
};

// Handle termination signals
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // Heroku or other platforms
