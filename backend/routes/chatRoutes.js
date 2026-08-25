import { Router } from 'express';
import { chat, getEmployees } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();
router.post('/', requireAuth, chat);
router.get('/employees', requireAuth, getEmployees);
export default router;
