import { handleChat } from '../chatbot/chatHandler.js';
import { searchEmployees } from '../services/employeeService.js';


export const chat = async (req, res, next) => {
  try {
    if (typeof req.body.message !== 'string') {
      return res.status(400).json({
        error: 'Message must be a string'
      });
    }
    const session =
      req.body.session || {
        step: 'COLLECTING_DETAILS',
        bookingData: {}
      };
    const result = await handleChat(
      req.body.message,
      session,
      req.user
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (
  req,
  res,
  next
) => {

  try {

    const query = req.query.q || '';

    const searchResult = await searchEmployees(
      query,
      req.user?.accessToken
    );


    return res.json({
      success: true,
      source: searchResult.source,
      employees: searchResult.results
    });

  } catch (error) {

    next(error);

  }
};