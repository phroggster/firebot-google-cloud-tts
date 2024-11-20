import GitHub from "./github";
import customPlugin from "./main";
import { SettingsProvider } from "./settings-provider";
import {
  PluginParams,
  UpdateCheckInterval,
} from "./types";

const intervalsMs: Record<UpdateCheckInterval, number> = {
  "Never": -200,
  "OnStart": -100,
  "TwiceDaily": 1000 * 60 * 60 * 12,
  "Daily": 1000 * 60 * 60 * 24,
  "TwoDays": 1000 * 60 * 60 * 24 * 2,
  "ThreeDays": 1000 * 60 * 60 * 24 * 3,
  "Weekly": 1000 * 60 * 60 * 24 * 7,
  "TwoWeeks": 1000 * 60 * 60 * 24 * 7 * 2,
  // 365.2422 days (86,400 seconds ea) per yr / 12 months = 30.43685 days/month
  "Monthly": 1000 * 60 * 60 * 24 * 30.43685,
};

export class UpdateManager {
  private _pluginTimeout: NodeJS.Timeout | null = null;
  private _voicesTimeout: NodeJS.Timeout | null = null;
  private readonly _startupUtcMs: number;

  constructor(settings: SettingsProvider) {
    this._startupUtcMs = new Date().getUTCMilliseconds();
    setTimeout(() => {
      this._scheduleUpdates(settings.params, true);
    }, 10 * 1000);
    customPlugin.on("paramsUpdated", (params) => {
      this._scheduleUpdates(params);
    });
    customPlugin.once("stopped", () => {
      if (this._pluginTimeout) {
        clearTimeout(this._pluginTimeout);
        this._pluginTimeout = null;
      }
      if (this._voicesTimeout) {
        clearTimeout(this._voicesTimeout);
        this._voicesTimeout = null;
      }
    });
  }

  private async _updatePlugin(): Promise<void> {
    const { dataProvider, settingsProvider } = customPlugin;
    const { autoUpgrade } = settingsProvider.params;

    const latest = GitHub.getLatestReleaseInfo("phroggster", "");

    // TODO:
    // Connect to github.
    // Get update info.
    // raise event or something.
    dataProvider.lastUpdateCheck = new Date();
  }

  private async _updateVoices(): Promise<void> {
    const { dataProvider, settingsProvider } = customPlugin;

    // TODO:
    // connect to gtts.
    // get voices.
    // raise event or something.
    dataProvider.lastVoicesCheck = new Date();
  }

  private _scheduleUpdates(
    params: PluginParams,
    isStartup: boolean = false,
  ): void {
    const { dataProvider, settingsProvider } = customPlugin;

    if (this._pluginTimeout !== null) {
      clearInterval(this._pluginTimeout);
      this._pluginTimeout = null;
    }
    if (this._voicesTimeout !== null) {
      clearInterval(this._voicesTimeout);
      this._voicesTimeout = null;
    }
    if (settingsProvider.restartPending
      || (params.pluginUpdateCheckInterval === "Never"
      && params.voicesUpdateInterval === "Never")
    ) {
      return;
    }

    const updateInterval = intervalsMs[params.pluginUpdateCheckInterval];
    const voiceInterval = intervalsMs[params.voicesUpdateInterval];
    const nowUtcMs = new Date().getUTCMilliseconds();

    if (isStartup && params.pluginUpdateCheckInterval === "OnStart") {
      this._pluginTimeout = setTimeout(async () => {
        await this._updatePlugin();
      }, 1000);
    } else if (updateInterval > 0) {
      const lastCheck = dataProvider.lastUpdateCheck?.getUTCMilliseconds() ?? 0;
      const nextCheck = Math.max(lastCheck + updateInterval, nowUtcMs + 1000);
      this._pluginTimeout = setTimeout(async () => {
        await this._updatePlugin();
      }, nextCheck - nowUtcMs);
    }

    if (isStartup && params.voicesUpdateInterval === "OnStart") {
      this._voicesTimeout = setTimeout(async () => {
        await this._updateVoices();
      }, 1000);
    } else if (voiceInterval > 0) {
      const lastCheck = dataProvider.lastVoicesCheck?.getUTCMilliseconds() ?? 0;
      const nextCheck = Math.max(lastCheck + voiceInterval, nowUtcMs + 1000);
      this._voicesTimeout = setTimeout(async () => {
        await this._updateVoices();
      }, nextCheck - nowUtcMs);
    }
  }
}
