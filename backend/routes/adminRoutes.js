import { Router } from 'express';
import { addAdmin, listUsers, monthlyReport, removeAdmin, updateAdmin } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/users', listUsers);
router.post('/admins', addAdmin);
router.delete('/admins/:email', removeAdmin);
router.patch('/users/:entraId/admin', updateAdmin);
router.get('/reports/monthly', monthlyReport);

export default router;
