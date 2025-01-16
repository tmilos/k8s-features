const { createLogger, format } = require('winston');
const TransportStream = require('winston-transport');
const { inspect } = require('node:util');
const colors = require('@colors/colors/safe');

colors.enabled = true;

class MyConsole extends TransportStream {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const { level, message, timestamp, ...rest } = info;

    console.log(`${colors.brightGreen(timestamp)} ${colors.brightGreen(level.toUpperCase())}: ${message}`);
    for (let k in rest) {
      const v = rest[k];
      if (true || typeof v === 'object' || typeof v === 'function') {
        console.log(`  ${colors.gray(k)}: ${inspect(v, undefined, 4)}`);
      }
    }

    if (callback) {
      callback();
    }
  }
}

class Logger {
  silent = false;

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
      ),
      transports: [
        new MyConsole({
          format: format.combine(
            //format.colorize(),
            format.splat(),
          ),
        }),
      ]
    });
  }

  /**
   * @param {string} messagge
   * @param {...any[]} meta
   */
  info() {
    if (this.silent) {
      return;
    }
    this.logger.info(...arguments);
  }

  /**
   * @param {string} messagge
   * @param {...any[]} meta
   */
  warn() {
    if (this.silent) {
      return;
    }
    this.logger.warn(...arguments);
  }

  /**
   * @param {string} messagge
   * @param {...any[]} meta
   */
  error() {
    if (this.silent) {
      return;
    }
    this.logger.error(...arguments);
  }
}

const logger = new Logger();

module.exports = {
  logger,
};
