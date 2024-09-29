import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { Logger } from "@crowbartools/firebot-custom-scripts-types/types/modules/logger";

import customPlugin from "./main";

export class ContextLogger implements Logger {
  private readonly _ctx: string;
  private readonly _logger: ScriptModules["logger"] | null;

  constructor(context: string, modules?: ScriptModules) {
    this._ctx = context;
    if (modules && modules.logger) {
      this._logger = modules.logger;
    } else {
      try {
        this._logger = customPlugin.logger;
      } catch {
        this._logger = null;
      }
    }
  }

  debug(logMessage: string, ...args: unknown[]) {
    this._logger?.debug(`${this._ctx}: ${logMessage}`, args);
  }
  info(logMessage: string, ...args: unknown[]) {
    this._logger?.info(`${this._ctx}: ${logMessage}`, args);
  }
  warn(logMessage: string, ...args: unknown[]) {
    this._logger?.warn(`${this._ctx}: ${logMessage}`, args);
  }
  error(logMessage: string, ...args: unknown[]) {
    this._logger?.error(`${this._ctx}: ${logMessage}`, args);
  }
  infoEx(logMessage: string, err: Error, ...args: unknown[]) {
    this._logger?.info(`${this._ctx}: ${logMessage} ${err.message}`, args);
  }
  warnEx(logMessage: string, err: Error, ...args: unknown[]) {
    this._logger?.warn(`${this._ctx}: ${logMessage} ${err.message}`, args);
  }
  errorEx(logMessage: string, err: Error, ...args: unknown[]) {
    this._logger?.error(`${this._ctx}: ${logMessage} ${err.message}`, args);
  }
}
