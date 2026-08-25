import { handleChat } from '../chatbot/stateMachine.js';
import { searchEmployees } from '../services/employeeService.js';

export const chat = async (req, res, next) => {
  try {
    if (typeof req.body.message !== 'string') return res.status(400).json({ error: 'Message must be a string' });
    const session = req.body.session || { step: 'AWAITING_BOOKING_INIT', bookingData: {} };
    res.json(await handleChat(req.body.message, session, req.user));
  } catch (error) { next(error); }
};

export const getEmployees = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const employees = await searchEmployees(query, req.user?.accessToken);
    res.json(employees);
  } catch (error) { next(error); }
};
