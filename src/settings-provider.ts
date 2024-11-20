import {
  RunRequest,
  RunRequestParameters,
} from "@crowbartools/firebot-custom-scripts-types";
import {
  FirebotSettings,
} from "@crowbartools/firebot-custom-scripts-types/types/settings";

import consts from "./consts";
import customPlugin from "./main";
import {
  PluginParams,
  ReadonlyPluginParams,
  UpdateCheckInterval,
  updateIntervalValueNames,
} from "./types";

export const defaultParams: Readonly<PluginParams> = {
  autoUpgrade: false,
  pluginUpdateCheckInterval: "Weekly",
  voicesUpdateInterval: "TwoWeeks",
};

/** Narrow down a string type to an UpdateCheckInterval type. */
function narrowUpdateCheckInterval(
  value: unknown,
  defaultValue: UpdateCheckInterval,
): UpdateCheckInterval {
  if (!value || typeof value !== "string") {
    return defaultValue;
  }
  return updateIntervalValueNames.find(vn =>
    vn.toLowerCase() === value.toLowerCase(),
  ) ?? defaultValue;
}

/** Narrow the wide params type provided to scripts to a strongly-typed
 * PluginParams instance.
 */
function narrowRunParams(
  params: RunRequestParameters<PluginParams>,
): PluginParams {
  return <PluginParams>{
    autoUpgrade: ('autoUpgrade' in params
      ? params.autoUpgrade === true
      : defaultParams.autoUpgrade),
    pluginUpdateCheckInterval: ('pluginUpdateCheckInterval' in params
      ? narrowUpdateCheckInterval(params.pluginUpdateCheckInterval,
        defaultParams.pluginUpdateCheckInterval)
      : defaultParams.pluginUpdateCheckInterval),
    voicesUpdateInterval: ('voicesUpdateInterval' in params
      ? narrowUpdateCheckInterval(params.voicesUpdateInterval,
        defaultParams.voicesUpdateInterval)
      : defaultParams.voicesUpdateInterval),
  };
};

/** A Firebot custom plugin settings provider. */
export class SettingsProvider {
  private readonly _audioFolderPath: string;
  private readonly _dataFilePath: string;
  private readonly _firebotSettings: FirebotSettings;
  private readonly _userAgent: string;
  private readonly _warnedOrigins: string[] = [];
  private _params: PluginParams;
  private _restartPending: boolean;

  constructor(runRequest: RunRequest<PluginParams>) {
    const { firebot } = runRequest;
    const { path } = runRequest.modules;

    // "%APPDATA%/Firebot/tmp/google-tts-revised"
    this._audioFolderPath = path.join(SCRIPTS_DIR, '..', '..', '..', '..',
      'tmp', 'google-tts-revised');
    // "%APPDATA%/Firebot/v5/profiles/{PROFILE}/scripts/gttsdata.json"
    this._dataFilePath = path.join(SCRIPTS_DIR, "gttsdata.json");
    this._firebotSettings = runRequest.firebot.settings;
    this._params = narrowRunParams(runRequest.parameters);
    this._restartPending = true;
    this._userAgent = `Firebot/${firebot.version}\
 firebot-google-tts-revised/${consts.PLUGIN_VERSION}`;

    customPlugin.on("paramsUpdated", (params) => {
      this._params = params;
    });
  }

  /** Get the path to the folder where audio files should be staged pending
   * playback.
   */
  get audioFolderPath(): string {
    return this._audioFolderPath;
  }

  /** Get the full path to the custom plugin's persistent JSON database file. */
  get dataFilePath(): string {
    return this._dataFilePath;
  }

  /** Get the custom plugin's default settings parameters. */
  get defaultParameters(): ReadonlyPluginParams {
    return defaultParams;
  }

  /** Get the Firebot settings provider. These are settings for things well
   * beyond the scope of this custom plugin, but need to be accessible.
   */
  get firebotSettings(): FirebotSettings {
    return this._firebotSettings;
  }

  /** Get the custom plugin's settings parameters. */
  get params(): PluginParams {
    return this._params;
  }

  /** Get a value indicating whether a Firebot restart is required such as
   * after initial plugin integration registration, or after a plugin update
   * was downloaded.
   */
  get restartPending(): boolean {
    return this._restartPending;
  }

  /** Set the value indicating whether or not a Firebot restart is required. */
  set restartPending(value: boolean) {
    this._restartPending = value;
  }

  /** Get the plugin's default User-Agent header value. This may be added to by
   * some effects.
   */
  get userAgent(): string {
    return this._userAgent;
  }

  /** Flags the provided origin as having an obsolete TTS effect usage. This is
   * merely a helper to avoid warning the user for every obsolete effect
   * execution.
   * @param origin The origin for the effects list containing the obsolete
   * effect.
   * @returns `true` if the origin has not been flagged before; `false`
   * otherwise.
   * @deprecated
   */
  // TODO: remove this once the obsolete effect ID gets removed.
  flagObsolete(origin: string): boolean {
    if (!this._warnedOrigins.includes(origin)) {
      this._warnedOrigins.push(origin);
      return true;
    }
    return false;
  }
}
