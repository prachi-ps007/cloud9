export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Forwards async errors to the Express error handler
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
