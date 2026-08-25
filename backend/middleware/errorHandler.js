export const errorHandler = (error, req, res, next) => {
  console.error('Unhandled API error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
};
