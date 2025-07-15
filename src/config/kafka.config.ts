import 'dotenv/config';
import { Kafka, logLevel, LogEntry, Producer, Consumer, ProducerRecord, CompressionTypes, Transaction, KafkaJSNumberOfRetriesExceeded, RecordMetadata } from 'kafkajs';

import logger from "../utils/logger.util";

class KafkaConfig {
    private kafka: Kafka;
    
    constructor() {
        const clientId = process.env.KAFKA_CLIENT_ID || 'my-app';
        const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
        const logLvl = process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.DEBUG;

        this.kafka = new Kafka({
            clientId: clientId,
            brokers: brokers,
            logLevel: logLvl,
            logCreator: this.kafkaLogCreator,
        });
    }

    private kafkaLogCreator = () => (logEntry: LogEntry) => {
        const { namespace, level, label, log } = logEntry;

        logger.debug(`>>>>> [${namespace}] ${label}: ${log.message}`, log);

        if (namespace === 'Consumer') {
            logger.info(`[${namespace}] ${label}: ${log.message}`, log);
        }

        if (level === logLevel.ERROR) {
            logger.error(`[${namespace}] ${label}: ${log.message}`, log);
        }
    };

    public createProducer(): Producer {
        return this.kafka.producer({
            allowAutoTopicCreation: process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION === 'true',
            retry: {
                retries: process.env.KAFKA_PRODUCER_RETRY_MAX_ATTEMPTS ? parseInt(process.env.KAFKA_PRODUCER_RETRY_MAX_ATTEMPTS, 10) : 5, // Default to 5 retries
                initialRetryTime: process.env.KAFKA_PRODUCER_RETRY_INITIAL_TIME_MS ? parseInt(process.env.KAFKA_PRODUCER_RETRY_INITIAL_TIME_MS, 10) : 1000, // 1 second
                maxRetryTime: process.env.KAFKA_PRODUCER_RETRY_MAX_TIME_MS ? parseInt(process.env.KAFKA_PRODUCER_RETRY_MAX_TIME_MS, 10) : 30000, // 30 seconds
                factor: process.env.KAFKA_PRODUCER_RETRY_FACTOR ? parseFloat(process.env.KAFKA_PRODUCER_RETRY_FACTOR) : 2.0, // Exponential backoff factor
                multiplier: process.env.KAFKA_PRODUCER_RETRY_MULTIPLIER ? parseFloat(process.env.KAFKA_PRODUCER_RETRY_MULTIPLIER) : 1.0, // Multiplier for retry time
                restartOnFailure: async (e) => {
                    console.error('❌ Producer failed:', e);
                    return true;
                },
            },
            idempotent: process.env.KAFKA_PRODUCER_ENABLE_IDEMPOTENCE === 'true',
            transactionalId: process.env.KAFKA_PRODUCER_TRANSACTIONAL_ID || 'my-transactional-id',
            transactionTimeout: process.env.KAFKA_PRODUCER_TRANSACTION_TIMEOUT_MS ? parseInt(process.env.KAFKA_PRODUCER_TRANSACTION_TIMEOUT_MS, 10) : 60000, // 60 seconds
            maxInFlightRequests: process.env.KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS ? parseInt(process.env.KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS, 10) : 5,
        });
    }

    public createConsumer(): Consumer {
        return this.kafka.consumer({
            groupId: process.env.KAFKA_GROUP_ID || 'my-group',
            allowAutoTopicCreation: process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION === 'true',
            sessionTimeout: process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS ? parseInt(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS, 10) : 30000, // 30 seconds
            heartbeatInterval: process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS ? parseInt(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS, 10) : 3000, // 3 seconds
            maxBytesPerPartition: process.env.KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION ? parseInt(process.env.KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION, 10) : 1048576, // 1 MB
            minBytes: process.env.KAFKA_CONSUMER_MIN_BYTES ? parseInt(process.env.KAFKA_CONSUMER_MIN_BYTES, 10) : 1, // 1 byte
            maxBytes: process.env.KAFKA_CONSUMER_MAX_BYTES ? parseInt(process.env.KAFKA_CONSUMER_MAX_BYTES, 10) : 10485760, // 10 MB
            maxWaitTimeInMs: process.env.KAFKA_CONSUMER_MAX_WAIT_TIME_MS ? parseInt(process.env.KAFKA_CONSUMER_MAX_WAIT_TIME_MS, 10) : 1000, // 1 second
            readUncommitted: process.env.KAFKA_CONSUMER_READ_UNCOMMITTED === 'true',
            retry: {
                retries: process.env.KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS ? parseInt(process.env.KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS, 10) : 5, // Default to 5 retries
                initialRetryTime: process.env.KAFKA_CONSUMER_RETRY_INITIAL_TIME_MS ? parseInt(process.env.KAFKA_CONSUMER_RETRY_INITIAL_TIME_MS, 10) : 1000, // 1 second
                maxRetryTime: process.env.KAFKA_CONSUMER_RETRY_MAX_TIME_MS ? parseInt(process.env.KAFKA_CONSUMER_RETRY_MAX_TIME_MS, 10) : 30000, // 30 seconds
                factor: process.env.KAFKA_CONSUMER_RETRY_FACTOR ? parseFloat(process.env.KAFKA_CONSUMER_RETRY_FACTOR) : 2.0, // Exponential backoff factor
                multiplier: process.env.KAFKA_CONSUMER_RETRY_MULTIPLIER ? parseFloat(process.env.KAFKA_CONSUMER_RETRY_MULTIPLIER) : 1.0, // Multiplier for retry time
                restartOnFailure: async (e) => {
                    console.error('❌ Consumer failed:', e);
                    return true;
                },
            },
        });
    }
}

class KafkaProducerConfig extends KafkaConfig {
    public producer!: Producer;
    private connected: boolean = false;
    private transaction: Transaction | null = null;

    constructor() {
        super();
        this.producer = this.createProducer();
    }

    public async connect() {
        try {
            await this.producer.connect();
            this.connected = true;
            logger.info('Kafka Producer connected successfully');
        } catch (error) {
            logger.error('Error connecting Kafka Producer:', error);
            this.connected = false;
            throw error; // Rethrow to handle it in the caller
        }
    }

    public async disconnect() {
        try {
            await this.producer.disconnect();
            this.connected = false;
            this.producer = {} as Producer; // Reset the producer instance
            logger.info('Kafka Producer disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting Kafka Producer:', error);
        }
    }

    public async isConnected(): Promise<boolean> {
        return this.connected;
    }

    public async beginTransaction(): Promise<Transaction> {
        if (!this.connected) {
            throw new Error("Kafka Producer is not connected");
        }

        this.transaction = await this.producer.transaction();
        if (!this.transaction) {
            throw new Error("Failed to start Kafka transaction");
        }
        return this.transaction;
    }

    public async getTransaction(): Promise<Transaction | null> {
        return this.transaction;
    }

    public async commitTransaction() {
        if (!this.transaction) {
            throw new Error("No transaction started. Call beginTransaction() first.");
        }
        await this.transaction.commit();
        this.transaction = null;
    }

    public async abortTransaction() {
        if (!this.transaction) {
            throw new Error("No transaction started. Call beginTransaction() first.");
        }
        await this.transaction.abort();
        this.transaction = null;
    }
    
    public async send(topic: string, message: any): Promise<RecordMetadata[]> {
        const record: ProducerRecord = {
            topic,
            messages: message, 
            acks: -1, // Wait for all replicas to acknowledge
            timeout: 30000, // 30 seconds timeout
            compression: CompressionTypes.GZIP,
        };

        if (!this.transaction) {
            throw new Error("No transaction started. Call beginTransaction() first.");
        }

        if (Array.isArray(message)) {
            record.messages = message.map(msg => ({
                value: JSON.stringify(msg),
                // headers: { 'content-type': 'application/json' }, --> Uncomment if you want to add headers
            }));
        } else {
            record.messages = [{
                value: JSON.stringify(message),
                // headers: { 'content-type': 'application/json' }, --> Uncomment if you want to add headers
            }];
        }

        try {
            // Send the record within the transaction
            return await this.transaction.send(record);
        } catch (error) {
            console.log(`The error instance type is: ${error}`);

            if (error instanceof KafkaJSNumberOfRetriesExceeded) {
                throw new Error(`Failed to send message after maximum retries due to ${error.message}`);
            }

            throw new Error(`Failed to connect producer before sending message due to ${error}`);
        }
    }
}

class KafkaConsumerConfig extends KafkaConfig {
    public consumer!: Consumer;
    private connected: boolean = false;

    constructor() {
        super();
        this.consumer = this.createConsumer();
    }

    public async connect() {
        try {
            await this.consumer.connect();
            this.connected = true;
            logger.info('Kafka Consumer connected successfully');
        } catch (error) {
            logger.error('Error connecting Kafka Consumer:', error);
            this.connected = false;
            throw error; // Rethrow to handle it in the caller
        }
    }

    public async disconnect() {
        try {
            await this.consumer.disconnect();
            this.connected = false;
            this.consumer = {} as Consumer; // Reset the consumer instance
            logger.info('Kafka Consumer disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting Kafka Consumer:', error);
        }
    }

    public async isConnected(): Promise<boolean> {
        return this.connected;
    }
}

export const kafkaProducerConfig = new KafkaProducerConfig();
export const kafkaConsumerConfig = new KafkaConsumerConfig();