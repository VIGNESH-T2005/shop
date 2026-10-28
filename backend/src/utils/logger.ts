// Minimal logger. Never pass secrets, tokens or card data to these functions.
const stamp = () => new Date().toISOString();
export const logger = {
  info: (...a: unknown[]) => console.log(stamp(), 'INFO ', ...a),
  warn: (...a: unknown[]) => console.warn(stamp(), 'WARN ', ...a),
  error: (...a: unknown[]) => console.error(stamp(), 'ERROR', ...a),
};
