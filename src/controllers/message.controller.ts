import "dotenv/config";
import { Request, Response } from "express";

import AppError from "../exceptions/app-error.exception";
import FormatResponse from "../utils/response.util";
import MessageResponse from "../dtos/message-response.dto";
import MessageService from "../services/message.service";
import { MessageRequestSchema } from "../dtos/message-request.dto";

/**
 * MessageController handles the message-related operations.
 * It includes methods for posting a single message, posting bulk messages,
 * retrieving all messages, and getting a message by ID.
 */
class MessageController {
    async postMessage(req: Request, res: Response): Promise<void> {
        // Validate the request body against the MessageRequestSchema
        // This will throw a ZodError if validation fails
        const messageRequest = MessageRequestSchema.parse(req.body);

        // Call the service to post the message
        const messageResponse: MessageResponse = await MessageService.postMessage(messageRequest);

        // If successful, send a success response
        res.status(201).json(
            FormatResponse({
                message: "Message created successfully",
                data: messageResponse,
                req,
            })
        );
    }

    async postBulkMessages(req: Request, res: Response): Promise<void> {
        // Validate the request body against the MessageRequestSchema
        // This will throw a ZodError if validation fails
        const messageRequests = MessageRequestSchema.array().parse(req.body);

        // Call the service to post bulk messages
        const messagesResponse: MessageResponse[] = await MessageService.postBulkMessages(messageRequests);

        // If successful, send a success response
        res.status(201).json(
            FormatResponse({
                message: "Messages created successfully",
                data: messagesResponse,
                req,
            })
        );
    }

    async getAllMessages(req: Request, res: Response): Promise<void> {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const sortBy = req.query.sortBy as string || 'createdAt';
        const sortOrder = req.query.sortOrder as string || 'desc';

        // Call the service to get all messages
        const messagesResponse: MessageResponse[] = await MessageService.getAllMessages(limit, offset, sortBy, sortOrder);
        if (!messagesResponse || messagesResponse.length === 0) {
            throw AppError.NotFound("No messages found", "There are no messages in the database.");
        }

        // If successful, send a success response
        res.status(200).json(
            FormatResponse({
                message: "Messages retrieved successfully",
                data: messagesResponse,
                req,
            })
        );
    }

    async getMessageById(req: Request, res: Response): Promise<void> {
        const messageId = req.params.id;

        // Call the service to get the message by ID
        const messageResponse: MessageResponse | null = await MessageService.getMessageById(messageId);
        if (!messageResponse) {
            throw AppError.NotFound("Message not found", `No message found with ID ${messageId}`);
        }

        // If successful, send a success response
        res.status(200).json(
            FormatResponse({
                message: "Message retrieved successfully",
                data: messageResponse,
                req,
            })
        );
    }
}

export default new MessageController();
