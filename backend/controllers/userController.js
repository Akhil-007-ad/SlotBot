import { getCurrentUser } from '../services/userService.js';

export const current = (req, res) => {
  res.json(getCurrentUser(req.user));
};
