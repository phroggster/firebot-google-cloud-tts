import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { getScriptController } from "./main";

const rootName = "gcptts";

export class ContextLogger {
  private readonly _context: string;

  constructor(context: string) {
    this._context = context;
  }

  debug(msg: string, ...args: unknown[]) {
    getScriptController()?.modules?.logger?.debug(`${rootName}.${this._context}: ${msg}`, args);
  }

  info(msg: string, ...args: unknown[]) {
    getScriptController()?.modules?.logger?.info(`${rootName}.${this._context}: ${msg}`, args);
  }

  warn(msg: string, ...args: unknown[]) {
    getScriptController()?.modules?.logger?.warn(`${rootName}.${this._context}: ${msg}`, args);
  }

  error(msg: string, ...args: unknown[]) {
    getScriptController()?.modules?.logger?.error(`${rootName}.${this._context}: ${msg}`, args);
  }

  exception(msg: string, error: unknown, ...args: unknown[]) {
    getScriptController()?.modules?.logger?.error(`${rootName}.${this._context} ${msg}: ${((error as Error)?.message || "unknown error")}`, args);
  }
}
