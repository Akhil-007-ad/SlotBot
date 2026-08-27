import { getMonthlyReport } from '../services/adminService.js';
import { grantAdminByEmail, listAdmins, revokeAdminByEmail, setAdminStatus } from '../services/userService.js';

export const listUsers = async (req, res, next) => {
  try {
    res.json({ users: await listAdmins() });
  } catch (error) { next(error); }
};

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const addAdmin = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    const user = await grantAdminByEmail(email);
    res.status(201).json({ user });
  } catch (error) { next(error); }
};

export const removeAdmin = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.params.email);
    const user = await revokeAdminByEmail(email);
    if (!user) return res.status(404).json({ error: 'Administrator not found.' });
    res.json({ user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

export const updateAdmin = async (req, res, next) => {
  try {
    if (typeof req.body.isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'isAdmin must be a boolean.' });
    }
    const user = await setAdminStatus(req.params.entraId, req.body.isAdmin);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

export const monthlyReport = async (req, res, next) => {
  try {
    const month = Number.parseInt(req.query.month, 10);
    const year = Number.parseInt(req.query.year, 10);
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'A valid month (1-12) and year are required.' });
    }
    res.json(await getMonthlyReport(month, year));
  } catch (error) { next(error); }
};
