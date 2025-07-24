/**
 * MessageResponse represents the structure of a message response object.
 * It includes the message ID, sender, receiver, content, and metadata.
 */
export default interface MessageResponse {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    createdAt: Date;
    status: string; // 'sent' | 'delivered' | 'read'
}