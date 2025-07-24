import Router from 'express';

import CatchAsync from '../utils/catch-async.util';
import MessageController from '../controllers/message.controller';
import Validate from '../middlewares/validator.middleware';
import { MessageRequestSchema } from "../dtos/message-request.dto";

/**
 * Message routes for handling message-related operations.
 * This includes posting a single message, posting bulk messages,
 * retrieving all messages, and getting a message by ID.
 */

const router = Router();

router.post('', Validate(MessageRequestSchema), CatchAsync(MessageController.postMessage));
router.post('/bulk', Validate(MessageRequestSchema.array()), CatchAsync(MessageController.postBulkMessages));
router.get('', CatchAsync(MessageController.getAllMessages));
router.get('/:id', CatchAsync(MessageController.getMessageById));

export default router;
