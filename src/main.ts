import {
  CustomScriptManifest,
  Firebot,
  RunRequest,
  ScriptModules,
  ScriptReturnObject,
} from "@crowbartools/firebot-custom-scripts-types";
import {
  ParametersConfig,
// eslint-disable-next-line @stylistic/max-len
} from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import {
  FirebotSettings,
} from "@crowbartools/firebot-custom-scripts-types/types/settings";
import { TypedEmitter } from "tiny-typed-emitter";

import firebotApi from "./firebot";
import { EffectRunner } from "./firebot/effects/better-effects";
import updateVoicesEffect from "./firebot/effects/update-voices";
import updateCheckEffect from "./firebot/effects/plugin-update-check";
import {
  BetterIntegrationManager,
} from "./firebot/integrations/better-integrations";

import consts from "./consts";
import { ContextLogger } from "./context-logger";
import { DataProvider } from "./data-provider";
import googleCloudApi from "./google-cloud";
import { defaultParams, SettingsProvider } from "./settings-provider";
import { PluginParams, updateIntervalValueNames } from "./types";
import { UpdateManager } from "./update-manager";
import { EventManager } from "./firebot/events/better-events";

interface CustomPluginEvents<TParams extends Record<string, unknown>> {
  paramsUpdated: (newParams: TParams) => void;
  stopped: () => void;
};

class CustomPlugin
  extends TypedEmitter<CustomPluginEvents<PluginParams>>
  implements Firebot.CustomScript<PluginParams>
// eslint-disable-next-line brace-style
{
  private _dataProvider?: DataProvider = undefined;
  private _modules?: ScriptModules = undefined;
  private _settings?: SettingsProvider = undefined;
  private _updateManager?: UpdateManager = undefined;

  /** Will either return the dataProvider module, or throw an error if it's not
   * available.
   */
  get dataProvider(): DataProvider | never {
    if (!this._dataProvider) {
      throw new Error("dataProvider is unavailable}");
    }
    return this._dataProvider;
  }
  /** Will either get the effectRunner module, or throw an error if it's not
   * available.
   */
  get effectRunner(): EffectRunner | never {
    if (!this._modules) {
      throw new Error("effectRunner is unavailable");
    }
    return this._modules.effectRunner as EffectRunner;
  }
  /** Will either get the eventManager module, or throw an error if it's not
   * available.
   */
  get eventManager(): EventManager | never {
    if (!this._modules) {
      throw new Error("eventManager is unavailable");
    }
    return this._modules.eventManager as EventManager;
  }
  /** Will either return the settings module, or throw an error if it's not
   * available.
   */
  get firebotSettings(): FirebotSettings | never {
    if (!this._settings) {
      throw new Error("firebotSettings is unavailable");
    }
    return this._settings.firebotSettings;
  }
  /** Will either return the frontendCommunicator module, or throw an error if
   * it's not available.
   */
  get frontendCommunicator(): ScriptModules["frontendCommunicator"] | never {
    if (!this._modules) {
      throw new Error("frontendCommunicator is unavailable");
    }
    return this._modules.frontendCommunicator;
  }
  /** Will either return the integrationManager module, or throw an error if
   * it's not available.
   */
  get integrationManager(): BetterIntegrationManager | never {
    if (!this._modules) {
      throw new Error("integrationManager is unavailable");
    }
    return this._modules.integrationManager as BetterIntegrationManager;
  }
  /** Will either return the default logger module, or throw an error if it's
   * not available.
   */
  get logger(): ScriptModules["logger"] | never {
    if (!this._modules) {
      throw new Error("logger is unavailable");
    }
    return this._modules.logger;
  }
  /** Will either return the path module, or throw an error if it's not
   * available.
   */
  get path(): ScriptModules["path"] | never {
    if (!this._modules) {
      throw new Error("path is unavailable");
    }
    return this._modules.path;
  }
  /** Will either return the custom plugin parameters, or throw an error if
   * it's not available.
   */
  get pluginParams(): PluginParams | never {
    if (!this._settings?.params) {
      throw new Error("pluginParams is not available");
    }
    return this._settings.params;
  }
  /** Will either return the resourceTokenManager module, or throw an error if
   * it's not available.
   */
  get resourceTokenManager(): ScriptModules["resourceTokenManager"] | never {
    if (!this._modules) {
      throw new Error("resourceTokenManager is unavailable");
    }
    return this._modules.resourceTokenManager;
  }
  /** Will either return the scriptModules collection, or throw an error if it's
   * not available.
   */
  get scriptModules(): ScriptModules | never {
    if (!this._modules) {
      throw new Error("scriptModules is unavailable");
    }
    return this._modules;
  }
  /** Will either return the settingsProvider module, or throw an error if it's
   * not available.
   */
  get settingsProvider(): SettingsProvider | never {
    if (!this._settings) {
      throw new Error("settingsProvider in unavailable");
    }
    return this._settings;
  }
  /** Will either return the updateManager module, or throw an error if it's
   * not available.
   */
  get updateManager(): UpdateManager {
    if (!this._updateManager) {
      throw new Error("updateManager is unavailable");
    }
    return this._updateManager;
  }

  /** Gets a manifest describing this custom plugin. */
  getScriptManifest(): CustomScriptManifest {
    return {
      author: "phroggie",
      description: "Adds Google Cloud Text-To-Speech (revised) effects for\
 high-quality speech synthesis",
      firebotVersion: "5",
      name: "Google Cloud TTS (revised)",
      startupOnly: true,
      version: consts.PLUGIN_VERSION,
      website: "https://github.com/phroggster/firebot-google-cloud-tts",
    };
  }

  /** Gets the parameter definitions for this custom plugin. */
  getDefaultParameters(): ParametersConfig<PluginParams> {
    return {
      autoUpgrade: {
        title: "Auto Upgrade",
        // boolean descriptions are useless at the moment...
        tip: "When enabled, plugin updates will be automatically installed\
 as they become available. You will have to manually restart Firebot to\
 complete an upgrade.",
        type: "boolean",
        default: defaultParams.autoUpgrade,
      },
      pluginUpdateCheckInterval: {
        title: "Update Check Interval",
        description: "How frequently the plugin should check for updates.",
        tip: `You can use the "**${updateCheckEffect.definition.name}**"\
 effect to manually check for updates on-demand, or let the plugin do it\
 automatically on a regular schedule.`,
        type: "enum",
        options: updateIntervalValueNames,
        default: defaultParams.pluginUpdateCheckInterval,
        searchable: false,
      },
      voicesUpdateInterval: {
        title: "Voices Update Interval",
        description: "How frequently the plugin should refresh the TTS voices\
 list.",
        tip: `You can use the "**${updateVoicesEffect.definition.name}**"\
 effect to update voices on-demand, or let the plugin do it automatically\
 on a regular schedule.`,
        type: "enum",
        options: updateIntervalValueNames,
        default: defaultParams.voicesUpdateInterval,
        searchable: false,
        showBottomHr: true,
      },
    };
  }

  /** The user has changed the plugin's parameters. */
  parametersUpdated?(params: PluginParams): void {
    this.emit("paramsUpdated", params);
  }

  /** Kick off "the show." */
  run(runRequest: RunRequest<PluginParams>): ScriptReturnObject {
    const { modules } = runRequest;
    this._modules = modules;

    const logger = new ContextLogger("gcptts.run", modules);
    logger.info("Google TTS revised plugin is initializing");

    this._settings ??= new SettingsProvider(runRequest);
    this._dataProvider ??= new DataProvider(modules, this._settings);
    this._updateManager ??= new UpdateManager(this._settings);

    let intCount = 0;
    firebotApi.integrations.forEach((integration) => {
      try {
        modules.integrationManager.registerIntegration(integration);
        googleCloudApi.addIntegration(integration.definition.id);
        intCount++;
        logger.debug(`Registered "${integration.definition.id}" integration`);
      } catch (err) {
        logger.warnEx(`Failed to register "${integration.definition.id}"\
 integration. Is it already loaded?`, err as Error, err);
      }
    });
    googleCloudApi.init();
    logger.debug(`Registered ${intCount} integration(s)`);

    let effCount = 0;
    firebotApi.effects.forEach((effect) => {
      try {
        modules.effectManager.registerEffect(effect);
        effCount++;
        logger.debug(`Registered "${effect.definition.id}" effect`);
      } catch (err) {
        logger.warnEx(`Failed to register "${effect.definition.name}" effect`,
          err as Error, err);
      }
    });
    logger.debug(`Registered ${effCount} effect(s)`);

    try {
      modules.eventManager.registerEventSource(firebotApi.events);
      logger.debug(`Registered ${firebotApi.events.events.length} events`);
    } catch (err) {
      logger.errorEx("Failed to register events", err as Error);
    }

    let varCount = 0;
    firebotApi.variables.forEach((variable) => {
      try {
        modules.replaceVariableManager.registerReplaceVariable(variable);
        varCount++;
      } catch (err) {
        logger.warnEx(`Failed to register replacement variable\
 "${variable.definition.handle}`, err as Error, err);
      }
    });
    logger.debug(`Registered ${varCount} variable(s)`);

    logger.info("The Google TTS revised custom plugin has started up");

    return {
      callback: undefined,
      errorMessage: undefined,
      effects: [],
      success: true,
    };
  }

  /** Cancel "the show." */
  stop(): void {
    const logger = new ContextLogger("gcptts.stop", this._modules);

    this.emit("stopped");

    // Might just be easiest to overthrow the various manager classes where
    // things get registered and unregister them using underhanded tactics?

    // At least undef'ing things will throw errors in the property wrappers...
    this._dataProvider = undefined;
    this._modules = undefined;
    this._settings = undefined;
    this._updateManager = undefined;
    logger.info("The Google TTS revised custom plugin has been stopped");

    this.removeAllListeners("paramsUpdated");
  }
}

const customPlugin = new CustomPlugin();
export default customPlugin;
