import { z } from "zod";

/**
 * Zod schema for validating message request data.
 * This schema ensures that the content is a non-empty string,
 * and both sender and receiver are valid UUIDs.
 */
export const MessageRequestSchema = z.object({
    content: z.string().min(1, "Content is required"),
    sender: z.string().uuid("Invalid sender ID format"),
    receiver: z.string().uuid("Invalid receiver ID format"),
});

export type MessageRequest = z.infer<typeof MessageRequestSchema>;