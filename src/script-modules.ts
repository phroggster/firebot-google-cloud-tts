import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";

export let logger: ScriptModules["logger"] = undefined;
export let modules: ScriptModules = undefined;

export function registerScriptModules(newModules: ScriptModules) {
    modules = newModules;
    logger = modules.logger;
}
