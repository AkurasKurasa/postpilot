// Express 4 doesn't catch errors from async handlers: a rejected await becomes an unhandled
// rejection and Node exits, taking the whole API down. Forward them to the error middleware instead.
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
