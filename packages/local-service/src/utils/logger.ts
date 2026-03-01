// Simple logger utility
const timestamp = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => {
    console.log(`[${timestamp()}] [INFO]`, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(`[${timestamp()}] [WARN]`, ...args);
  },
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.debug(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },
};
