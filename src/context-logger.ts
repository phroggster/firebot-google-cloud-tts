import { modules } from "./main";

const rootName = "gcptts";

export class ContextLogger {
  private readonly _context: string;

  constructor(context: string) {
    this._context = context;
  }

  debug(msg: string, ...args: unknown[]) {
    modules?.logger.debug(`${rootName}.${this._context}: ${msg}`, args);
  }

  info(msg: string, ...args: unknown[]) {
    modules?.logger.info(`${rootName}.${this._context}: ${msg}`, args);
  }

  warn(msg: string, ...args: unknown[]) {
    modules?.logger.warn(`${rootName}.${this._context}: ${msg}`, args);
  }

  error(msg: string, ...args: unknown[]) {
    modules?.logger.error(`${rootName}.${this._context}: ${msg}`, args);
  }

  exception(msg: string, error: Error, ...args: unknown[]) {
    modules?.logger.error(`${rootName}.${this._context} ${msg}: ${(error.message || "unknown error")}`, args);
  }
}
