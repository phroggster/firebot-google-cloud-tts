import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import fs from "fs";
import { JsonDB } from "node-json-db";
import { Config as JsonDBConfig } from "node-json-db/dist/lib/JsonDBConfig";

import consts from "./consts";
import { ContextLogger } from "./context-logger";
import { EventData as VoicesChanged } from "./firebot/events/voices-changed";
import customPlugin from "./main";
import { SettingsProvider } from "./settings-provider";
import {
  ExtendedVoiceInfo,
  LocaleInfo,
  VoiceInfo,
  VoicePricingTier,
  VoiceStyle,
} from "./types";

import localesJson from "../data/locales.json";
import voicesJson from "../data/voices.json";

/** The desired shape of the JSON db on-disk. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type PluginDataModel = {
  /** The timestamp of the most-recent plugin update check. */
  lastUpdateCheck?: Date | null,
  /** The timestamp of the most-recent voices update. */
  lastVoicesUpdate?: Date | null,
  locales: LocaleInfo[],
  voices: VoiceInfo[],
};
type ReplaceVoicesResult = {
  newVoiceNames: string[];
  removedVoiceNames: string[];
};

/** A read-writable data repository for the plugin.
 *
 * JSON data for the plugin is included in the webpack, but this data can and
 * will be updated at runtime either manually from effects executing or
 * automatically. So this class de/serializes such data from/to the data file.
 */
export class DataProvider {
  /** The meat and potatoes. */
  private readonly _db: JsonDB;

  /** The UTC timestamp of when the next database flush must occur by. This may
   * differ from write timeout.
   */
  private _writeDeadlineUtcMs: number | null = null;
  /** The timeout of the next pending database flush. This may be pushed back
   * if changes occur while a flush is pending.
   */
  private _writeTimeout: NodeJS.Timeout | null = null;


  /** Constructs a new DataProvider for persisting plugin data.
   * @param modules The ScriptModules object provided to the custom plugin.
   * @param pluginsDir The location on-disk of where Firebot plugins are stored.
   * @param userAgent The base user-agent to send along with requests, e.g.
   * "Firebot/v5.63.2 firebot-google-tts-revised/1.0.0"
   */
  constructor(modules: ScriptModules, settings: SettingsProvider) {
    const logger = new ContextLogger("gcptts.data.ctor", modules);
    const { frontendCommunicator } = modules;

    // Hook Custom Plugin events
    customPlugin.once("stopped", () => {
      this.flush();
    });

    // Hook UI events
    frontendCommunicator.on("gcpttsGetLocales", (..._args: unknown[]) => {
      const localesList = this.locales;
      //const evtLog = new ContextLogger("gcptts.data.getLocales");
      // evtLog.debug(`Received gcpttsGetLocales event with args ` +
      //   `"${_args != null && _args.length > 0 ? _args : "(empty)"}", ` +
      //   `replying with ${localesList.length ?? 0} locales`);
      return localesList;
    });
    frontendCommunicator.on("gcpttsGetVoices", (..._args: unknown[]) => {
      const extVoicesList = this.getAllExtendedVoices();
      // const evtLog = new ContextLogger("gcptts.data.getLocales");
      // evtLog.debug(`Received gcpttsGetVoices event with args ` +
      //   `"${_args != null && _args.length > 0 ? _args : "(empty)"}", ` +
      //   `replying with ${extVoicesList.length} voices`);
      return extVoicesList;
    });

    this._db = new JsonDB(new JsonDBConfig(settings.dataFilePath, false, true,
      "/", undefined));

    // Try and load DB, returning early when successful.
    if (fs.existsSync(settings.dataFilePath)) {
      try {
        this._db.load();
        if (this._db.exists("/locales") && this._db.exists("/voices")) {
          settings.restartPending = false;
          return;
        }
      } catch (err) {
        logger.warnEx(
          `Failed to load db from "${settings.dataFilePath}"`,
          err as Error,
        );
        this._db.resetData({});
      }
    }

    // Either:
    //   JSON db file did not exist,
    //   could not be loaded and got reset,
    //   or was missing a required property path
    if (!this._db.exists("/locales")) {
      try {
        this._db.push("/locales", <LocaleInfo[]>localesJson.locales);
      } catch (err) {
        logger.warnEx("Failed to initialize db /locales data", err as Error);
      }
    }
    if (!this._db.exists("/voices")) {
      try {
        this._db.push("/voices", <VoiceInfo[]>voicesJson.voices);
      } catch (err) {
        logger.warnEx("Failed to initialize db /voices data", err as Error);
      }
    }

    this._setWriteTimeout(10 * 1000);
  }

  /** Get the date that we last checked GitHub for updates to this plugin. */
  get lastUpdateCheck(): Date | null {
    try {
      if (this._db.exists("/lastUpdateCheck")) {
        return this._db.getObject<Date | null>("/lastUpdateCheck");
      }
    } catch {
    }
    return null;
  }

  /** Set the date that we last checked Github for updates to this plugin. */
  set lastUpdateCheck(date: Date) {
    try {
      this._db.push("/lastUpdateCheck", date.toUTCString());
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.setLastUpdateCheck");
      logger.warnEx("Failed to save last update check to db", err as Error);
    }
  }

  /** Get the date that we last pulled the voices list from Google's TTS API. */
  get lastVoicesCheck(): Date | null {
    try {
      if (this._db.exists("/lastVoiceUpdate")) {
        return this._db.getObject<Date | null>("/lastVoiceUpdate");
      }
    } catch {
    }
    return null;
  }

  /** Set the date that we last pulled the voices list from Google's TTS API. */
  set lastVoicesCheck(value: Date) {
    try {
      this._db.push("/lastVoiceUpdate", value.toUTCString());
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.setLastVoicesCheck");
      logger.warnEx("Failed to save last voice update to db", err as Error);
    }
  }

  /** Get a list of known locale information, such as
   * `[ id: "en-US", name: "English (United States)" ]`.
   */
  get locales(): LocaleInfo[] {
    try {
      return this._db.getObject<LocaleInfo[]>("/locales")
        || localesJson.locales;
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.locales");
      logger.warnEx("failed to get locales", err as Error, err as Error);
    }
    return localesJson.locales;
  }

  /** Get a list of known Google TTS voices. */
  get voices(): VoiceInfo[] {
    try {
      return this._db.getObject<VoiceInfo[]>("/voices")
        || voicesJson.voices;
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.voices");
      logger.warnEx("Failed to get voices", err as Error, err as Error);
    }
    return voicesJson.voices as VoiceInfo[];
  }

  set voices(value: VoiceInfo[]) {
    try {
      this._db.delete("/voices");
      this._db.push("/voices", value);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.setVoices");
      logger.warnEx("Failed to set voices", err as Error, err as Error);
    }
  }


  /** Flush the database to disk. */
  flush(): void {
    try {
      this._db.save();
      if (this._writeTimeout) {
        clearTimeout(this._writeTimeout);
      }
      this._writeTimeout = null;
      this._writeDeadlineUtcMs = null;
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.flush");
      logger.warnEx("Failed to flush db", err as Error, err as Error);
    }
  }

  /** Gets all voices with their extended language information. */
  getAllExtendedVoices(): ExtendedVoiceInfo[] {
    try {
      const voices = this.voices;
      return voices
        .map((voice) => {
          return {
            ...voice,
            localeInfo: this.getVoiceLocaleInfo(voice.name),
          };
        })
        .filter(voiceWithLocaleInfo => voiceWithLocaleInfo != null
          && voiceWithLocaleInfo.localeInfo != null
          && voiceWithLocaleInfo.localeInfo.id != null
          && voiceWithLocaleInfo.localeInfo.name != null,
        ).map((voiceWithLocaleInfo) => {
          return {
            gender: voiceWithLocaleInfo.ssmlGender === "NEUTRAL"
              ? "SSML_VOICE_GENDER_UNSPECIFIED"
              : voiceWithLocaleInfo.ssmlGender,
            languageCode: voiceWithLocaleInfo.localeInfo?.id ?? "",
            languageName: voiceWithLocaleInfo.localeInfo?.name ?? "",
            name: voiceWithLocaleInfo.name,
            pricing: this.getVoicePricing(voiceWithLocaleInfo.name),
            sampleRate: voiceWithLocaleInfo.naturalSampleRateHertz,
            type: this.getVoiceStyle(voiceWithLocaleInfo.name),
          };
        });
    } catch {
    }
    return [];
  }

  /** Finds a locale's information by BCP-47 ID. */
  getLocaleInfo(localeId: string): LocaleInfo | null {
    const locales = this.locales.filter(loc => loc.id === localeId);
    if (locales.length >= 1) {
      // shortest locale id wins, sorry
      return locales.sort((lhs, rhs) => {
        if (lhs.id.length < rhs.id.length) {
          return -1;
        }
        if (lhs.id.length > rhs.id.length) {
          return 1;
        }
        return 0;
      })[0];
    }
    return null;
  }

  /** Finds a voice's information by voice name. */
  getVoiceInfo(voiceName: string): VoiceInfo | null {
    const voices = this.voices.filter(voice => voice.name === voiceName);
    if (voices.length >= 1) {
      return voices[0];
    }
    return null;
  }

  /** Get the language/locale information from the provided voice name.
   * @param voiceName The name of the voice to get the language code from.
   * @returns The language and locale code, as well as the plain-text English
   * description of that langCode.
   */
  getVoiceLocaleInfo(voiceName: string): LocaleInfo | null {
    const voice = this.getVoiceInfo(voiceName);
    if (voice && voice.languageCodes.length > 0) {
      return this.getLocaleInfo(voice.languageCodes[0]);
    }
    return null;
  }

  /** Get the pricing tier of the specified voice name.
   * @param voiceName The name of the voice to get the pricing tier of.
   * @returns The pricing tier of the specified voice.
   */
  getVoicePricing(
    voiceName: string,
  ): VoicePricingTier {
    if (voiceName.includes("Casual")) {
      // TODO: Not sure of the actual pricing tier for casual voices, but only
      // news (studio) voices currently go up to K, so maybe?
      return "Studio";
    } else if (voiceName.includes("Journey")) {
      return "Journey";
    } else if (voiceName.includes("Neural2")) {
      return "Neural2";
    } else if (voiceName.includes("News")) {
      return "Studio";
    } else if (voiceName.includes("Polyglot")) {
      return "Polyglot";
    } else if (voiceName.includes("Standard")) {
      return "Standard";
    } else if (voiceName.includes("Studio")) {
      return "Studio";
    } else if (voiceName.includes("Wavenet")) {
      return "Wavenet";
    }
    return "Unknown";
  }

  /** Get the voice style utilized by the specified voice name.
   * @param voiceName The name of the voice to get the voice type of.
   * @returns A string representing the type of voice utilized by the specified
   * voice name.
   */
  getVoiceStyle(
    voiceName: string,
  ): VoiceStyle {
    if (voiceName.includes("Casual")) {
      return "Casual";
    } else if (voiceName.includes("Journey")) {
      return "Journey";
    } else if (voiceName.includes("Neural2")) {
      return "Neural2";
    } else if (voiceName.includes("News")) {
      return "News";
    } else if (voiceName.includes("Polyglot")) {
      return "Polyglot";
    } else if (voiceName.includes("Standard")) {
      return "Standard";
    } else if (voiceName.includes("Studio")) {
      return "Studio";
    } else if (voiceName.includes("Wavenet")) {
      return "Wavenet";
    }
    return "Unknown";
  }

  /** Check if a voice with the given name is saved in the data store. This is
   * useful for checking if a voice name variable expanded legitimately, or if
   * the effect should use the fallback voice.
   * @param voiceName The name of the voice to check.
   * @returns `true` if a voice with that name is listed in the data store;
   * `false` otherwise.
   */
  isKnownVoiceName(
    voiceName: string,
  ): boolean {
    // Short-cut if it has an unexpanded variable, or is null/undefined.
    if (!voiceName || voiceName.includes('$')) {
      return false;
    }
    return this.voices.some(voice => voice.name === voiceName);
  }

  /** Replace locale information in the data store matching langCode (or all
   * voices when undefined) with the provided LocaleInfo array.
   * @param localesToAdd The new locales to add or update.
   * @param langCodeToReplace Optional Any language code starting with this
   * value will be removed.
   */
  replaceLocales(
    localesToAdd: LocaleInfo[],
    langCodeToReplace?: string,
  ): void {
    if (!localesToAdd || localesToAdd.length === 0) {
      return;
    }

    const locales = this.locales.filter(locale => langCodeToReplace == null
      || locale.id.startsWith(langCodeToReplace));
    locales.push(...localesToAdd);
    locales.sort((lhs, rhs) => lhs.id.localeCompare(rhs.id));
    try {
      this._db.push("/locales", locales, true);
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.replaceLocales");
      logger.warnEx(
        `Failed to add ${localesToAdd.length} locales for lang code\
 "${(langCodeToReplace != null ? langCodeToReplace : "all")}"`,
        err as Error, err as Error);
    }
  }

  /** Replace the voices in the data store matching langCode (or all voices
   * when undefined) with the provided voices array.
   * @param newVoices An array of the voices that have been refreshed and
   * should be added to the data store.
   * @param langCode An optional BCP-47 language code of the subset of voices
   * to replace.
   * @returns Information about the added or removed entries.
   */
  replaceVoices(
    newVoices: VoiceInfo[],
    langCode?: string,
  ) : ReplaceVoicesResult {
    const result: ReplaceVoicesResult = {
      newVoiceNames: [],
      removedVoiceNames: [],
    };
    if (!newVoices || newVoices.length === 0) {
      return result;
    }

    const startingVoices = this.voices;
    const voicesToDelete = !langCode
      ? startingVoices
      : startingVoices.filter(voice =>
        voice.languageCodes.some(lc => lc.startsWith(langCode)));
    result.newVoiceNames = newVoices.filter(voice =>
      !voicesToDelete.some(rem => rem.name === voice.name))
      .map(voice => voice.name);
    result.removedVoiceNames = voicesToDelete.filter(voice =>
      !newVoices.some(nvn => nvn.name === voice.name))
      .map(voice => voice.name);

    let voices = result.removedVoiceNames.length <= 0
      ? startingVoices
      : startingVoices.filter(voice =>
        !result.removedVoiceNames.some(rvn => rvn === voice.name));
    voices.push(...newVoices);
    voices = voices.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    try {
      this._db.push("/voices", voices, true);
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.replaceVoices");
      logger.warnEx("Failed to push to database", err as Error, err as Error);
    }

    if (result.newVoiceNames.length || result.removedVoiceNames.length) {
      customPlugin.eventManager.triggerEvent(consts.EVENT_SOURCE_ID,
        consts.VOICES_CHANGED_EVENT_ID, <VoicesChanged>{
          voicesAdded: result.newVoiceNames,
          voicesRemoved: result.removedVoiceNames,
        });
    }

    return result;
  }

  private _setWriteTimeout(maxDelayMs: number): void {
    maxDelayMs = Math.max(maxDelayMs, 0);
    const nowUtcMs = Date.now();
    const oldDeadlineUtcMs = this._writeDeadlineUtcMs
      ? this._writeDeadlineUtcMs
      : Number.MAX_SAFE_INTEGER;

    // flush now.
    if (maxDelayMs <= 100 || oldDeadlineUtcMs < nowUtcMs) {
      this.flush();
      return;
    }

    const newDeadlineUtcMs = nowUtcMs + maxDelayMs;
    if (newDeadlineUtcMs < oldDeadlineUtcMs) {
      // new deadline is earlier, tee it up
      if (this._writeTimeout) {
        clearTimeout(this._writeTimeout);
      }
      this._writeDeadlineUtcMs = newDeadlineUtcMs;
      this._writeTimeout = setTimeout(() => {
        this.flush();
      }, newDeadlineUtcMs - nowUtcMs);
    }
  }
}
