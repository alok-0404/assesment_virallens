const silent = process.env.NODE_ENV === 'test' && !process.env.DEBUG_LOGS;

function write(stream, level, args) {
  if (silent) return;
  stream(new Date().toISOString(), level, ...args);
}

export const logger = {
  info: (...args) => write(console.log, 'INFO ', args),
  warn: (...args) => write(console.warn, 'WARN ', args),
  error: (...args) => write(console.error, 'ERROR', args),
};
