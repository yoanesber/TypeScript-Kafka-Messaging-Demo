export default interface MessageResponse {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    createdAt: Date;
    status: string; // 'sent' | 'delivered' | 'read'
}