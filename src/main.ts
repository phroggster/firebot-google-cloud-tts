import { Firebot, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { FirebotSettings } from "@crowbartools/firebot-custom-scripts-types/types/settings";

import consts from "./consts";
import { ContextLogger } from "./context-logger";
import scriptEffects from "./effects";
import gcp from "./google-cloud-api";
import authIntegrations from "./integrations";
import { DataProvider } from "./data-provider";
import {
  EUpdateCheckFrequency,
  IPluginParams,
  PluginFolders,
} from "./types";

export let modules: ScriptModules | null = null;
export let settings: FirebotSettings | null = null;
export let pluginParams: IPluginParams | null = null;
export let folders: PluginFolders | null = null;
export let dataProvider: DataProvider | null = null;

const script: Firebot.CustomScript<IPluginParams> = {
  getDefaultParameters: () => {
    return {
      pluginUpdateCheckInterval: {
        title: "Update Check Interval",
        description: "How frequently the plugin should check for updates.",
        // TODO: insert effect name here
        tip: "You can also manually check for plugin updates with the TODO effect.",
        type: "enum",
        options: Object.values(EUpdateCheckFrequency),
        default: EUpdateCheckFrequency.OnStart,
        searchable: false,
      },
      voiceUpdateCheckInterval: {
        title: "Voice Updates Interval",
        description: "How frequently the plugin should check for TTS voice updates.",
        // TODO: insert effect name here
        tip: "You can also manually check for voice updates with the TODO effect.",
        type: "enum",
        options: Object.values(EUpdateCheckFrequency),
        default: EUpdateCheckFrequency.Weekly,
        searchable: false,
      },
    };
  },
  getScriptManifest: () => {
    return {
      author: "phroggie",
      description: "Adds the Google Cloud Text-To-Speech (revised) effects for high-quality speech synthesis",
      firebotVersion: "5",
      name: "Google Cloud TTS (revised) Effects",
      startupOnly: true,
      version: consts.PLUGIN_VERSION,
      website: "https://github.com/phroggster/firebot-google-cloud-tts",
    };
  },
  parametersUpdated: (params) => {
    pluginParams = params;
  },
  run: (runRequest) => {
    const logger = new ContextLogger("main.run()");

    modules = runRequest.modules;
    settings = runRequest.firebot.settings;
    pluginParams = {
      pluginUpdateCheckInterval: ((runRequest.parameters as IPluginParams)?.pluginUpdateCheckInterval as EUpdateCheckFrequency) ?? consts.DEFAULT_PLUGIN_PARAMS.pluginUpdateCheckInterval,
      voiceUpdateCheckInterval: ((runRequest.parameters as IPluginParams)?.voiceUpdateCheckInterval as EUpdateCheckFrequency) ?? consts.DEFAULT_PLUGIN_PARAMS.voiceUpdateCheckInterval,
    };
    folders = {
      dataDir: modules.path.join(SCRIPTS_DIR, '..', 'google-tts-revised'),
      tmpDir: modules.path.join(SCRIPTS_DIR, '..', '..', '..', '..', 'tmp', 'google-tts-revised'),
    };
    dataProvider = new DataProvider(folders.dataDir, modules.path);

    gcp.userAgent ??= `Firebot/${runRequest.firebot.version} firebot-google-tts-revised/${consts.PLUGIN_VERSION}`;
    authIntegrations.forEach((integration) => {
      try {
        runRequest.modules.integrationManager.registerIntegration(integration);
        gcp.addIntegration(integration.definition.id);
      } catch (err) {
        logger.exception(`Failed to register integration ${integration.definition.name}`, err as Error);
      }
    });
    scriptEffects.forEach((effect) => {
      try {
        runRequest.modules.effectManager.registerEffect(effect);
      } catch (err) {
        logger.exception(`Failed to register effect "${effect.definition.name}"`, err as Error);
      }
    });

    return {
      effects: [],
      success: true,
    };
  },
  stop: () => {
    dataProvider = null;
    folders = null;
    pluginParams = null;
    settings = null;
    modules = null;
  },
};
export default script;
