import "dotenv/config";
import { ValidationError, ValidationErrorItem, DatabaseError } from 'sequelize';

import AppError from "../exceptions/app-error.exception";
import DatabaseConfig from "../config/db.config";
import MessageResponse from "../dtos/message-response.dto";
import { kafkaProducerConfig as KafkaProducerConfig } from "../config/kafka.config";
import { Message, MessageCreationAttributes } from "../models/message.model";
import { MessageRequest, MessageRequestSchema } from "../dtos/message-request.dto";

/**
 * MessageService handles the business logic for message operations.
 * It includes methods for posting a single message, posting bulk messages,
 * retrieving all messages, and getting a message by ID.
 */
class MessageService {
    private message_topic: string;

    constructor() {
        this.message_topic =  process.env.KAFKA_TOPIC || 'messaging';
    }

    public async postMessage(messageRequest: MessageRequest): Promise<MessageResponse> {
        // Validate the message request
        const validationResult = MessageRequestSchema.safeParse(messageRequest);
        if (!validationResult.success) {
            throw AppError.BadRequest("Invalid message request", validationResult.error.errors);
        }

        // Extract the validated message data
        const request = validationResult.data;

        // Prepare the message object
        const message: MessageCreationAttributes = {
            content: request.content,
            sender: request.sender,
            receiver: request.receiver,
            status: 'sent', // Default status when creating a message
        };

        // Start a transaction
        const t = await DatabaseConfig.beginTransaction();

        // Start kafka transaction
        await KafkaProducerConfig.beginTransaction();

        try {
            // Save the message to the database
            const messageRecord = await Message.create(message, { transaction: t });

            // Send the message to Kafka
            await KafkaProducerConfig.send(this.message_topic, messageRecord);

            // Commit the transaction
            await KafkaProducerConfig.commitTransaction();
            await DatabaseConfig.commitTransaction();

            // Return the message response
            return messageRecord as MessageResponse;
        } catch (error) {
            // Abort/rollback the transaction if any error occurs
            await KafkaProducerConfig.abortTransaction();
            await DatabaseConfig.rollbackTransaction();

            if (error instanceof AppError) {
                throw error; // Re-throw known AppErrors
            }
            
            if (error instanceof ValidationError) {
                const messages = error.errors.map((e: ValidationErrorItem) => e.message);
                throw AppError.BadRequest("Validation errors occurred", messages);
            }
            
            if (error instanceof DatabaseError) {
                throw AppError.InternalServerError("Database error", `An error occurred while interacting with the database: ${error.message}`);
            }

            throw AppError.InternalServerError("Failed to post message", `${error}`);
        }
    }

    public async postBulkMessages(messageRequest: MessageRequest[]): Promise<MessageResponse[]> {
        // Validate the messages request
        const validationResult = MessageRequestSchema.array().safeParse(messageRequest);
        if (!validationResult.success) {
            throw AppError.BadRequest("Invalid messages request", validationResult.error.errors);
        }

        // Extract the validated messages data
        if (validationResult.data.length === 0) {
            throw AppError.BadRequest("Messages array cannot be empty");
        }

        // Prepare the messages array
        const messages: MessageCreationAttributes[] = validationResult.data.map(msg => ({
            ...msg,
            status: 'sent', // Default status when creating a message
        }));

        // Start a transaction
        const t = await DatabaseConfig.beginTransaction();

        // Start kafka transaction
        await KafkaProducerConfig.beginTransaction();

        try {
            // Save the messages to the database
            // Using bulkCreate for better performance with multiple records
            const messageRecords = await Message.bulkCreate(messages, { transaction: t });

            // Send the message to Kafka
            
            await KafkaProducerConfig.send(this.message_topic, messageRecords);

            // Commit the transaction
            await KafkaProducerConfig.commitTransaction();
            await DatabaseConfig.commitTransaction();

            // Return the messages response
            return messageRecords as MessageResponse[];
        } catch (error) {
            // Abort/rollback the transaction if any error occurs
            await KafkaProducerConfig.abortTransaction();
            await DatabaseConfig.rollbackTransaction();

            if (error instanceof AppError) {
                throw error; // Re-throw known AppErrors
            }

            if (error instanceof ValidationError) {
                const messages = error.errors.map((e: ValidationErrorItem) => e.message);
                throw AppError.BadRequest("Validation errors occurred", messages);
            }

            if (error instanceof DatabaseError) {
                throw AppError.InternalServerError("Database error", `An error occurred while interacting with the database: ${error.message}`);
            }

            throw AppError.InternalServerError("Failed to post messages", `${error}`);
        }
    }

    public async getAllMessages(limit = 10, offset = 0, sortBy = 'createdAt', sortOrder = 'asc'): Promise<MessageResponse[]> {
        try {
            // Fetch all messages with pagination and sorting
            const messages = await Message.findAll({
                order: [[sortBy, sortOrder.toUpperCase()]],
                limit: limit,
                offset: offset,
            });

            return messages as MessageResponse[];
        } catch (error) {
            if (error instanceof AppError) {
                throw error; // Re-throw known AppErrors
            }

            if (error instanceof DatabaseError) {
                throw AppError.InternalServerError("Database error", `An error occurred while interacting with the database: ${error.message}`);
            }

            throw AppError.InternalServerError("An unexpected error occurred while fetching messages", `${error}`);
        }
    }

    public async getMessageById(id: string): Promise<MessageResponse | null> {
        try {
            // Fetch the message by ID
            const message = await Message.findByPk(id);
            if (!message) {
                throw AppError.NotFound(`Message with ID ${id} not found`);
            }

            return message as MessageResponse;
        } catch (error) {
            if (error instanceof AppError) {
                throw error; // Re-throw known AppErrors
            }

            if (error instanceof DatabaseError) {
                throw AppError.InternalServerError("Database error", `An error occurred while interacting with the database: ${error.message}`);
            }

            throw AppError.InternalServerError("An unexpected error occurred while fetching the message", `${error}`);
        }
    }
}

export default new MessageService();
