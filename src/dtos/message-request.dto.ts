import { z } from "zod";

export const MessageRequestSchema = z.object({
    content: z.string().min(1, "Content is required"),
    sender: z.string().uuid("Invalid sender ID format"),
    receiver: z.string().uuid("Invalid receiver ID format"),
});

export type MessageRequest = z.infer<typeof MessageRequestSchema>;