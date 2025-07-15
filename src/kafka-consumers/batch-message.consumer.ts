import "dotenv/config";
import { EachBatchPayload } from 'kafkajs';

import logger from "../utils/logger.util";
import { kafkaConsumerConfig as KafkaConsumerConfig } from "../config/kafka.config";
import { Message } from "../models/message.model";

class KafkaBatchMessageConsumer {
    private message_topic: string;

    constructor() {
        this.message_topic = process.env.KAFKA_TOPIC || 'messaging';
    }

    public async start() {
        try {
            // Start consuming messages
            await this.batchMessageConsumer();
        } catch (error) {
            logger.error(`Error starting Kafka Batch Message Consumer: ${error}`);
            throw error; // Rethrow to handle it in the caller
        }
    }

    public async stop() {
        try {
            // Disconnect the consumer
            await KafkaConsumerConfig.disconnect();
            logger.info("Kafka Consumer disconnected successfully");
        } catch (error) {
            logger.error(`Error disconnecting Kafka Consumer: ${error}`);
        }
    }

    private async batchMessageConsumer(): Promise<void> {
        try {
            // Subscribe to the topic
            await KafkaConsumerConfig.consumer.subscribe({ topic: this.message_topic, fromBeginning: true });
        } catch (error) {
            logger.error(`❌ Error starting Kafka Message Delivery Consumer: ${error}`);
            throw error; // Rethrow to handle it in the caller
        }

        // Define the batch message handler
        await KafkaConsumerConfig.consumer.run({
            autoCommit: false, // Disable auto commit to handle batches manually
            eachBatchAutoResolve: false, // Disable auto resolve to handle batch processing manually
            partitionsConsumedConcurrently: 1, // Consume 1 partition at a time
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary, uncommittedOffsets, isRunning, isStale }: EachBatchPayload) => {
                await heartbeat();
                for (const message of batch.messages) {
                    // Check if the consumer is running and not stale
                    if (!isRunning() || isStale()) {
                        logger.warn("⚠️ Consumer is not running or is stale, stopping batch processing.");
                        break; // Stop processing if consumer is not running or is stale
                    }

                    // Read the message value
                    const msgValue = message.value ? message.value.toString() : '';
                    if (!msgValue) {
                        continue;
                    }
                    
                    // Parse the message value as JSON to extract the message ID
                    let data: Message;
                    try {
                        data = JSON.parse(msgValue) as Message;
                    } catch (error) {
                        continue;
                    }

                    // Capture the message ID from the parsed data
                    const messageId = data.id;
                    if (!messageId) {
                        continue;
                    }

                    try {
                        // Fetch the message record from the database
                        const messageRecord = await Message.findByPk(messageId, {
                            attributes: ['id', 'status', 'content'], // Fetch only necessary fields
                        });
                        if (!messageRecord) {
                            continue;
                        }
                        
                        // if (messageRecord.content === "Happy birthday! Hope you have a great day.") {
                        //     continue; // Skip processing this specific message content
                        // }

                        if (messageRecord.status === 'delivered') {
                            resolveOffset(message.offset);
                            await heartbeat();
                            continue;
                        }

                        // Update the message status to 'delivered'
                        messageRecord.status = 'delivered';
                        await messageRecord.save();

                        // After processing the message, resolve the offset
                        resolveOffset(message.offset);
                        await heartbeat();
                    } catch (error) {
                        logger.error("Error processing message:", error);
                        continue;
                    }
                }

                // Commit only offsets that have been resolved
                try {
                    await commitOffsetsIfNecessary();
                } catch (commitError) {
                    logger.error(`❌ Error committing offsets: ${commitError}`);
                }
            },
        });
    };
}

export default new KafkaBatchMessageConsumer();