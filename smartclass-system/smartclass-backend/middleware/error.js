
class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wraps async route handlers so thrown errors flow into errorHandler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Validation errors
  if (err.array && typeof err.array === 'function') {
    return res.status(422).json({ error: 'Validation failed', details: err.array() });
  }
  // MySQL duplicate
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate record', details: err.sqlMessage });
  }
  // FK violations
  if (err.code && err.code.startsWith('ER_NO_REFERENCED_ROW')) {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
