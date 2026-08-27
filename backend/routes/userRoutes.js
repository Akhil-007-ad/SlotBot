import { Router } from 'express';
import { current } from '../controllers/userController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.get('/me', requireAuth, current);

export default router;
