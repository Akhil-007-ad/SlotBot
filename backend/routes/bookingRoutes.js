import { Router } from 'express';
import { cancel, history, listToday } from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();
router.get('/', requireAuth, listToday);
router.get('/history', requireAuth, history);
router.delete('/:id', requireAuth, cancel);
export default router;
