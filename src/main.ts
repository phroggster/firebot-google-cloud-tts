import { CustomScriptManifest, Firebot, RunRequest, ScriptModules, ScriptReturnObject } from "@crowbartools/firebot-custom-scripts-types";
import { ParametersConfig } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { FirebotSettings } from "@crowbartools/firebot-custom-scripts-types/types/settings";
import { TypedEmitter } from "tiny-typed-emitter";

import consts from "./consts";
import { ContextLogger } from "./context-logger";
import { DataProvider } from "./data-provider";
import firebot from "./firebot";
import updateVoicesEffect from "./firebot/effects/update-voices";
import gcp from "./gcp";
import integrations from "./firebot/integrations";

interface PluginParams extends Record<string, unknown> {
  /** How often should the script check for new updates. */
  pluginUpdateCheckInterval: "Never" | "OnStart" | "Daily" | "TwoDays" | "ThreeDays" | "Weekly" | "TwoWeeks" | "Monthly";
  /** How often should the script check for voice list updates. */
  voiceUpdateCheckInterval: "Never" | "OnStart" | "Daily" | "TwoDays" | "ThreeDays" | "Weekly" | "TwoWeeks" | "Monthly";
};

interface CustomPluginEvents<TParams extends Record<string, unknown>> {
  loading: (runRequest: RunRequest<TParams>) => void;
  loaded: (params: TParams) => void;
  paramsUpdating: (oldParams: TParams, newParams: TParams) => void;
  paramsUpdated: (newParams: TParams) => void;
  unloading: () => void;
  unloaded: () => void;
};

const defaultUpdateInterval = "Weekly";

class CustomPlugin extends TypedEmitter<CustomPluginEvents<PluginParams>> implements Firebot.CustomScript<PluginParams> {
  private _dataProvider?: DataProvider;
  private _settings?: FirebotSettings;
  private _modules?: ScriptModules;
  private _pluginParams: PluginParams;

  constructor() {
    super();
    this._pluginParams = <PluginParams>{
      pluginUpdateCheckInterval: defaultUpdateInterval,
      voiceUpdateCheckInterval: defaultUpdateInterval,
    };
  }

  get dataProvider(): DataProvider | never {
    if (!this._dataProvider) {
      throw new Error("dataProvider is unavailable}");
    }
    return this._dataProvider;
  }
  get firebotSettings(): FirebotSettings | never {
    if (!this._settings) {
      throw new Error("firebotSettings is unavailable");
    }
    return this._settings;
  }
  get pluginParams(): PluginParams | never {
    if (!this._pluginParams) {
      throw new Error("pluginParams is not available");
    }
    return this._pluginParams;
  }

  get frontendCommunicator(): ScriptModules["frontendCommunicator"] | never {
    if (!this._modules) {
      throw new Error("frontendCommunicator is unavailable");
    }
    return this._modules.frontendCommunicator;
  }
  get integrationManager(): ScriptModules["integrationManager"] | never {
    if (!this._modules) {
      throw new Error("integrationManager is unavailable");
    }
    return this._modules.integrationManager;
  }
  get logger(): ScriptModules["logger"] | never {
    if (!this._modules) {
      throw new Error("logger is unavailable");
    }
    return this._modules.logger;
  }
  get path(): ScriptModules["path"] | never {
    if (!this._modules) {
      throw new Error("path is unavailable");
    }
    return this._modules.path;
  }
  get resourceTokenManager(): ScriptModules["resourceTokenManager"] | never {
    if (!this._modules) {
      throw new Error("resourceTokenManager is unavailable");
    }
    return this._modules.resourceTokenManager;
  }

  getScriptManifest(): CustomScriptManifest {
    return {
      author: "phroggie",
      description: "Adds the Google Cloud Text-To-Speech (revised) effects for high-quality speech synthesis",
      firebotVersion: "5",
      name: "Google Cloud TTS (revised)",
      startupOnly: true,
      version: consts.PLUGIN_VERSION,
      website: "https://github.com/phroggster/firebot-google-cloud-tts",
    };
  }

  getDefaultParameters(): ParametersConfig<PluginParams> {
    return {
      pluginUpdateCheckInterval: {
        title: "Update Check Interval",
        description: "How frequently the plugin should check for updates.",
        // TODO: insert effect name here
        tip: `You can use the "{insert effect name here}" effect to check for plugin updates on-demand, or let the plugin do it automatically on a regular schedule.`,
        type: "enum",
        options: ["Never", "OnStart", "Daily", "TwoDays", "ThreeDays", "Weekly", "TwoWeeks", "Monthly"],
        default: defaultUpdateInterval,
        searchable: false,
      },
      voiceUpdateCheckInterval: {
        title: "Voice Updates Interval",
        description: "How frequently the plugin should refresh the TTS voice list.",
        tip: `You can use the "${updateVoicesEffect.definition.name}" effect to update voices on-demand, or let the script do it automatically on a regular schedule.`,
        type: "enum",
        options: ["Never", "OnStart", "Daily", "TwoDays", "ThreeDays", "Weekly", "TwoWeeks", "Monthly"],
        default: defaultUpdateInterval,
        searchable: false,
      },
    };
  }

  parametersUpdated?(params: PluginParams): void {
    this.emit("paramsUpdating", this._pluginParams, params);
    this._pluginParams = params;
    this.emit("paramsUpdated", params);
  }

  run(runRequest: RunRequest<PluginParams>): ScriptReturnObject /* | Promise<ScriptReturnObject> */ {
    this._settings = runRequest.firebot.settings;
    this._modules = runRequest.modules;

    const logger = new ContextLogger("gcptts.main.run", runRequest.modules);
    logger.info("Google TTS revised plugin is starting up, trigger was:", runRequest.trigger);

    this._dataProvider = new DataProvider(SCRIPTS_DIR, runRequest.modules);
    this._pluginParams = {
      pluginUpdateCheckInterval: (runRequest.parameters as PluginParams)?.pluginUpdateCheckInterval || defaultUpdateInterval,
      voiceUpdateCheckInterval: (runRequest.parameters as PluginParams)?.voiceUpdateCheckInterval || defaultUpdateInterval,
    };

    this.emit("loading", runRequest);

    firebot.integrations.forEach((integration) => {
      try {
        integration.initialize(runRequest.modules);
        runRequest.modules.integrationManager.registerIntegration(integration.integration());
        gcp.addIntegration(integration.integration().definition.id);
      } catch (err) {
        logger.warnEx(`Failed to register "${integration.integration().definition.name}" integration. Is it already loaded?`, err as Error, err);
      }
    });

    firebot.effects.forEach((effect) => {
      try {
        runRequest.modules.effectManager.registerEffect(effect);
      } catch (err) {
        logger.warnEx(`Failed to register "${effect.definition.name}" effect`, err as Error, err);
      }
    });
    firebot.variables.forEach((variable) => {
      try {
        runRequest.modules.replaceVariableManager.registerReplaceVariable(variable);
      } catch (err) {
        logger.warnEx(`Failed to register replacement variable "${variable.definition.handle}`, err as Error, err);
      }
    });

    gcp.userAgent = `Firebot/${runRequest.firebot.version} firebot-google-tts-revised/${consts.PLUGIN_VERSION}`;

    this.emit("loaded", this._pluginParams);
    logger.info("Google TTS revised plugin has started up");

    return {
      callback: undefined,
      errorMessage: undefined,
      effects: [],
      success: true,
    };
  }

  stop(): void {
    const logger = new ContextLogger("gcptts.stop", this._modules);
    this.emit("unloading");

    // TODO: `undefined` everything? Can't unload most things. sigh.
    // Might just be easier to chop up the manager classes where things are registered...
    logger.info("Stopping plugin");

    this.emit("unloaded");
  }
}

const customPlugin = new CustomPlugin();
export default customPlugin;
