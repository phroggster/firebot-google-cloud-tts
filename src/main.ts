import { CustomScriptManifest, Firebot, RunRequest, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { ParametersConfig } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { FirebotSettings } from "@crowbartools/firebot-custom-scripts-types/types/settings";
import { TypedEmitter } from "tiny-typed-emitter";

import consts from "./consts";
import { ContextLogger } from "./context-logger";
import scriptEffects from "./effects";
import gcp from "./google-cloud-api";
import authIntegrations from "./integrations";
import { DataProvider } from "./data-provider";
import {
  EUpdateCheckFrequency,
  IPluginController,
  IPluginEvents,
  IPluginParams,
  IDataProvider,
  PluginFolders,
} from "./types";

class PluginEventEmitter extends TypedEmitter<IPluginEvents> { }

class GcpTtsPluginController
  extends PluginEventEmitter
  implements IPluginController {
  // see src/backend/common/handlers/custom-scripts/custom-script-helpers.js:buildModules() for the full exported modules list.
  private _dataProvider: DataProvider = null;
  private _modules: ScriptModules = null;
  private _pluginParams: IPluginParams = null;
  private _settings: FirebotSettings = null;
  private _scriptFolders: PluginFolders = null;

  /** Starts execution of the Google Cloud TTS revised custom script. */
  async start(runRequest: RunRequest<IPluginParams>) {
    const logger = new ContextLogger("main.start()");

    this._modules = runRequest.modules;
    this._settings = runRequest.firebot.settings;
    this._scriptFolders = {
      dataDir: runRequest.modules.path.join(SCRIPTS_DIR, '..', 'google-tts-revised'),
      tmpDir: runRequest.modules.path.join(SCRIPTS_DIR, '..', '..', '..', '..', 'tmp', 'google-tts-revised')
    };
    this._pluginParams = {
      pluginUpdateCheckInterval: (runRequest.parameters as IPluginParams)?.pluginUpdateCheckInterval ?? consts.DEFAULT_PLUGIN_PARAMS.pluginUpdateCheckInterval as EUpdateCheckFrequency,
      voiceUpdateCheckInterval: (runRequest.parameters as IPluginParams)?.voiceUpdateCheckInterval ?? consts.DEFAULT_PLUGIN_PARAMS.voiceUpdateCheckInterval as EUpdateCheckFrequency
    };

    this._dataProvider ??= new DataProvider(this._scriptFolders.dataDir, this._modules.path);

    gcp.userAgent = `Firebot/${(runRequest.firebot?.version || "v5")} firebot-google-tts-revised/${consts.PLUGIN_VERSION}`;
    authIntegrations.forEach(integration => {
      try {
        runRequest.modules.integrationManager.registerIntegration(integration);
        gcp.addIntegration(integration.definition.id);
      } catch (err) {
        logger.exception(`Failed to register integration ${integration.definition.name}`, err)
      }
    });
    scriptEffects.forEach(effect => {
      try {
        runRequest.modules.effectManager.registerEffect(effect);
      } catch (err) {
        logger.exception(`Failed to register effect "${effect.definition.name}"`, err);
      }
    });
  }

  /** Stops execution of the Google Cloud TTS revised custom script. */
  stop() {
    this.emit("unloading");
    this._pluginParams = null;
    this._scriptFolders = null;

    this.emit("unloaded");
    this._modules = null;
  }

  /** Gets the default script parameters configuration for the Google Cloud TTS Revised custom script. */
  getDefaultParameters(): ParametersConfig<IPluginParams> {
    return {
      pluginUpdateCheckInterval: {
        title: "Update Check Interval",
        description: "How frequently the plugin should check for updates.",
        // TODO: insert effect name here
        tip: "You can also manually check for plugin updates using the TODO effect.",
        type: "enum",
        options: Object.values(EUpdateCheckFrequency),
        default: EUpdateCheckFrequency.OnStart,
        searchable: false
      },
      voiceUpdateCheckInterval: {
        title: "Voice Updates Interval",
        description: "How frequently the plugin should check for TTS voice updates.",
        // TODO: insert effect name here
        tip: "You can also manually check for voice updates using the TODO effect.",
        type: "enum",
        options: Object.values(EUpdateCheckFrequency),
        default: EUpdateCheckFrequency.Weekly,
        searchable: false
      },
    };
  }

  /** Gets the Google Cloud TTS Revised custom script manifest. */
  getScriptManifest(): CustomScriptManifest {
    return {
      author: "phroggie",
      description: "Adds the Google Cloud Text-To-Speech (revised) effects for high-quality speech synthesis",
      firebotVersion: "5",
      name: "Google Cloud TTS (revised) Effects",
      startupOnly: true,
      version: consts.PLUGIN_VERSION,
      website: "https://github.com/phroggster/firebot-google-cloud-tts"
    };
  }

  /** Sets the script parameters to be used by the Google Cloud TTS revised custom script. */
  updateScriptParams(params: IPluginParams) {
    this.emit("parametersUpdating", this._pluginParams, params);
    this._pluginParams = params;
    this.emit("parametersUpdated", params);
  }


  private _validateScriptModules(): void | never {
    if (!this._modules) {
      throw new ReferenceError("Firebot custom script modules for the Google Cloud TTS revised plugin are not loaded");
    }
  }

  get dataProvider(): IDataProvider {
    this._validateScriptModules();
    return this._dataProvider;
  }
  get folders(): PluginFolders {
    this._validateScriptModules();
    return this._scriptFolders;
  }
  get isEnabled(): boolean {
    return this._pluginParams != null;
  }
  get firebotSettings(): FirebotSettings {
    return this._settings;
  }
  get modules(): ScriptModules {
    this._validateScriptModules();
    return this._modules;
  }
  get scriptManifest(): CustomScriptManifest {
    this._validateScriptModules();
    return this.getScriptManifest();
  }
  get scriptParams(): IPluginParams {
    this._validateScriptModules();
    return this._pluginParams;
  }
}

/** Gets the Google Cloud TTS revised custom script controller. Many of these interfaces are not safe to use outside of main.ts */
export const gcpTtsScriptController = new GcpTtsPluginController();

/** Gets the hardened interface of the Google Cloud TTS revised custom script controller. */
export function getScriptController(): IPluginController {
  return gcpTtsScriptController;
};

const script: Firebot.CustomScript<IPluginParams> = {
  getDefaultParameters: gcpTtsScriptController.getDefaultParameters,
  getScriptManifest: gcpTtsScriptController.getScriptManifest,
  parametersUpdated: gcpTtsScriptController.updateScriptParams,
  run: gcpTtsScriptController.start,
  stop: gcpTtsScriptController.stop
};
export default script;
