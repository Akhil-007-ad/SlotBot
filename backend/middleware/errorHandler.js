export const errorHandler = (error, req, res, next) => {
  let status = error.status || error.statusCode || 500;
  let message = status < 500 ? error.message : 'Internal Server Error';

  if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body contains invalid JSON.';
  } else if (error.name === 'ValidationError') {
    status = 400;
    message = Object.values(error.errors).map(item => item.message).join(' ');
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'A request identifier is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'A record with those details already exists.';
  }

  const log = status >= 500 ? console.error : console.warn;
  log(`[${req.id || 'no-request-id'}] ${req.method} ${req.originalUrl}:`, error.message);

  res.status(status).json({
    error: message,
    requestId: req.id
  });
};
