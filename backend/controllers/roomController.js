import { getActiveRooms, updateRoomOutlookEmail } from '../services/roomService.js';

export const list = async (req, res, next) => {
  try {
    const minCapacity = Number.parseInt(req.query.minCapacity, 10);
    // Pass full req.user so roomService can filter by department
    res.json(await getActiveRooms(Number.isNaN(minCapacity) ? undefined : minCapacity, req.user));
  } catch (error) {
    next(error);
  }
};

export const updateOutlookEmail = async (req, res, next) => {
  try {
    // Restrict to IT or Admin department
    const allowed = ['admin', 'it'];
    if (!allowed.includes(req.user?.department?.toLowerCase())) {
      return res.status(403).json({ error: 'IT or Admin department required to update room email.' });
    }
    if (!req.body.outlookEmail || typeof req.body.outlookEmail !== 'string') {
      return res.status(400).json({ error: 'outlookEmail is required' });
    }
    const room = await updateRoomOutlookEmail(req.params.name, req.body.outlookEmail);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: `outlookEmail updated for ${room.name}`, room });
  } catch (error) {
    next(error);
  }
};
