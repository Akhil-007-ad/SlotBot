import { Router } from 'express';
import { cancel, listToday } from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();
router.get('/', requireAuth, listToday);
router.delete('/:id', requireAuth, cancel);
export default router;
