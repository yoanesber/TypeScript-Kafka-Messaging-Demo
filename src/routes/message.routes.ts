import Router from 'express';

import CatchAsync from '../utils/catch-async.util';
import MessageController from '../controllers/message.controller';
import Validate from '../middlewares/validator.middleware';
import { MessageRequestSchema } from "../dtos/message-request.dto";

const router = Router();

router.post('', Validate(MessageRequestSchema), CatchAsync(MessageController.postMessage));
router.post('/bulk', Validate(MessageRequestSchema.array()), CatchAsync(MessageController.postBulkMessages));
router.get('', CatchAsync(MessageController.getAllMessages));
router.get('/:id', CatchAsync(MessageController.getMessageById));

export default router;
