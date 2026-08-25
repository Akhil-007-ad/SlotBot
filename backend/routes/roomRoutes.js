import { Router } from 'express';
import { list, updateOutlookEmail } from '../controllers/roomController.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();
router.get('/', requireAuth, list);
router.patch('/:name/outlook', requireAuth, updateOutlookEmail);
export default router;
