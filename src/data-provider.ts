import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import fs from "fs";
import { JsonDB } from "node-json-db";
import { Config as JsonDBConfig } from "node-json-db/dist/lib/JsonDBConfig";

import { ContextLogger } from "./context-logger";
import {
  ExtendedVoiceInfo,
  LocaleInfo,
  VoiceInfo,
  VoicePricingTier,
  VoiceType,
} from "./types";

import localesJson from "../data/locales.json";
import voicesJson from "../data/voices.json";

type LastUpdateCheckDataModel = {
  plugin?: Date,
  voices?: Date,
};
/** The desired shape of the JSON db on-disk. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type PluginDataModel = {
  lastChecks?: LastUpdateCheckDataModel,
  locales: LocaleInfo[],
  voices: VoiceInfo[],
};
type ReplaceVoicesResult = {
  newVoiceNames: string[];
  removedVoiceNames: string[];
};

const datastoreFilename = "gttsdata.json";

/**
 * A repository for maintaining the data files and settings that the plugin utilizes.
 *
 * JSON data for the plugin is included in the webpack, but this data can and will be updated at
 * runtime either manually through an effect or automatically. So this class will simply
 * de/serialize such data from/to the plugin's data directory.
 *
 * It will not retain data in-memory, and everything about it is designed to be async to/from disk.
 */
export class DataProvider {
  private readonly _db: JsonDB;
  /** The path to the folder where temporary audio files will be downloaded to, played from, and deleted. */
  private readonly _audioFolderPath: string;
  /** The path to the data store file on disk. */
  private readonly _dataFilePath: string;

  private _writeDeadlineUtcMs: number | null = null;
  private _writeTimeout: NodeJS.Timeout | null = null;


  /**
   * Constructs a new DataProvider persisting data in the specified path.
   * @param dataDir The location on-disk of where to store any data files.
   * @param pluginsDir The location on-disk of where Firebot plugins are stored.
   * @param path A helper utility for safely concatenating filesystem paths.
   */
  constructor(pluginsDir: string, modules: ScriptModules) {
    const logger = new ContextLogger("gcptts.data.ctor");
    const { frontendCommunicator, path } = modules;

    this._audioFolderPath = path.join(pluginsDir, '..', '..', '..', '..', 'tmp', 'google-tts-revised');
    this._dataFilePath = path.join(pluginsDir, datastoreFilename);

    // attach pertinent events.
    frontendCommunicator.on("gcpttsGetLocales", (...args: unknown[]) => {
      const localesList = this.locales;
      logger.debug(`Received gcpttsGetLocales event with args "${args != null && args.length ? args : "(empty)"}", replying with ${localesList.length} items`);
      return localesList;
    });
    frontendCommunicator.on("gcpttsGetVoices", (...args: unknown[]) => {
      const extVoicesList = this.getAllExtendedVoices();
      logger.debug(`Received gcpttsGetVoices event with args "${args != null && args.length ? args : "(empty)"}", replying with ${extVoicesList?.length} voices`);
      return extVoicesList;
    });

    this._db = new JsonDB(new JsonDBConfig(this._dataFilePath, false, true, "/"));
    if (fs.existsSync(this._dataFilePath)) {
      try {
        this._db.load();
        if (this._db.exists("/locales") && this._db.exists("/voices")) {
          return;
        }
      } catch {
        this._db.resetData({});
      }
    }

    // Database either didn't exist, couldn't be loaded and got reset, or was missing a required property.
    if (!this._db.exists("/locales")) {
      try {
        this._db.push("/locales", localesJson);
      } catch (err) {
        logger.warnEx("Failed to initialize /locales", err as Error);
      }
    }
    if (!this._db.exists("/voices")) {
      try {
        this._db.push("/voices", voicesJson);
      } catch (err) {
        logger.warnEx("Failed to initialize /voices", err as Error);
      }
    }

    this._setWriteTimeout(10 * 1000);
  }

  /** Get the path to the folder where audio files should be (temporarily) stored. */
  get audioFolderPath(): string {
    return this._audioFolderPath;
  }

  /** Get the full path to the JSON database file on-disk. */
  get dataFilePath(): string {
    return this._dataFilePath;
  }

  /** Get the date that we last checked github for updates to this plugin. */
  get lastUpdateCheck(): Date | null {
    try {
      if (this._db.exists("/lastChecks/plugin")) {
        return this._db.getObject<Date>("/lastChecks/plugin") ?? null;
      }
    } catch {
    }
    return null;
  }

  /** Gets an object representing the last time we checked for plugin updates and voice updates. */
  get lastUpdateChecks(): LastUpdateCheckDataModel | null {
    try {
      if (this._db.exists("/lastChecks")) {
        return this._db.getObject<LastUpdateCheckDataModel>("/lastChecks") ?? null;
      }
    } catch {
    }
    return null;
  }

  /** Get the date that we last pulled the voices list from Google's TTS API. */
  get lastVoicesCheck(): Date | null {
    try {
      if (this._db.exists("/lastChecks/voices")) {
        return this._db.getObject<Date>("/lastChecks/voices") ?? null;
      }
    } catch {
    }
    return null;
  }

  /** Get a list of known locale information, such as [ id: "en-US", desc: "English (United States)" ]. */
  get locales(): LocaleInfo[] {
    try {
      if (this._db.exists("/locales")) {
        return this._db.getObject<LocaleInfo[]>("/locales") ?? [];
      }
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.locales");
      logger.warnEx("failed to get locales", err as Error, err as Error);
    }
    return localesJson.locales;
  }

  /** Get a list of known Google TTS voices. */
  get voices(): VoiceInfo[] {
    try {
      return this._db.getObject<VoiceInfo[]>("/voices") ?? [];
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.voices");
      logger.warnEx("Failed to get voices", err as Error, err as Error);
    }
    return [];
  }

  /** Write the database to disk immediately. */
  flush(): void {
    try {
      this._db.save();
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.flush");
      logger.warnEx("Failed to non-forcibly flush database", err as Error, err as Error);
    }
  }

  /** Gets all voices and their language information. */
  getAllExtendedVoices(): ExtendedVoiceInfo[] {
    try {
      const voices = this._db.getObject<VoiceInfo[]>("/voices");
      return voices
        .map((voice) => {
          return {
            ...voice,
            localeInfo: this.voiceLocaleInfo(voice.name),
          };
        })
        .filter(voiceWithLocaleInfo => voiceWithLocaleInfo && voiceWithLocaleInfo.localeInfo && voiceWithLocaleInfo.localeInfo.id && voiceWithLocaleInfo.localeInfo.name)
        .map((voiceWithLocaleInfo) => {
          return {
            gender: voiceWithLocaleInfo.ssmlGender === "NEUTRAL" ? "SSML_VOICE_GENDER_UNSPECIFIED" : voiceWithLocaleInfo.ssmlGender,
            // nulls are filtered just above this, and undefineds should never make here, but my IDE complains without the defensive nullish coalesce.
            languageCode: voiceWithLocaleInfo.localeInfo?.id ?? "",
            languageName: voiceWithLocaleInfo.localeInfo?.name ?? "",
            name: voiceWithLocaleInfo.name,
            pricing: this.voicePricing(voiceWithLocaleInfo.name),
            sampleRate: voiceWithLocaleInfo.naturalSampleRateHertz,
            type: this.voiceType(voiceWithLocaleInfo.name),
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

  /**
   * Check if a voice with the given name is saved in the data store. This is useful for checking if
   * a voice name variable expanded legitimately, or if the effect should use the fallback voice.
   * @param voiceName The name of the voice to check.
   * @returns `true` if a voice with that name is listed in the data store; `false` otherwise.
   */
  isKnownVoiceName(voiceName: string): boolean {
    // A dollar sign here... Did variable expansion mess up, or did the user?
    if (!voiceName || voiceName.includes('$')) {
      return false;
    }
    return this.voices.some(voice => voice.name === voiceName);
  }

  /**
   * Replace locale information in the data store matching langCode (or all voices when undefined or "all") with the provided LocaleInfo array.
   * @param localesToAdd The new locales to add or update.
   * @param langCodeToReplace Optional Any language code starting with this value will be removed.
   */
  replaceLocales(localesToAdd: LocaleInfo[], langCodeToReplace?: string): void {
    if (!localesToAdd || localesToAdd.length === 0) {
      return;
    }

    const locales = this.locales.filter(locale => !langCodeToReplace || langCodeToReplace === "all" || locale.id.startsWith(langCodeToReplace));
    locales.push(...localesToAdd);
    locales.sort((lhs, rhs) => lhs.id.localeCompare(rhs.id));
    try {
      this._db.push("/locales", locales, true);
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.replaceLocales");
      logger.warnEx(`Failed to add ${localesToAdd.length.toLocaleString()} locales for lang code "${(langCodeToReplace ? langCodeToReplace : "all")}`, err as Error, err as Error);
    }
  }

  /**
   * Replace the voices in the data store matching langCode (or all voices when undefined) with the provided voices array.
   * @param newVoices An array of the voices that have been refreshed and should be added to the data store.
   * @param langCode An optional BCP-47 language code of the subset of voices to replace.
   * @returns Information about the added or removed entries.
   */
  replaceVoices(newVoices: VoiceInfo[], langCode?: "all" | string): ReplaceVoicesResult {
    const result: ReplaceVoicesResult = {
      newVoiceNames: [],
      removedVoiceNames: [],
    };
    if (!newVoices || newVoices.length === 0) {
      return result;
    }

    const startingVoices = this.voices;

    // calculate the return value first
    const voicesToDelete = startingVoices.filter(voice => voice.languageCodes.some(lc => !langCode || langCode === "all" || lc.startsWith(langCode)));
    result.newVoiceNames = newVoices.filter(voice => !voicesToDelete.some(rem => rem.name === voice.name)).map(voice => voice.name);
    result.removedVoiceNames = voicesToDelete.filter(voice => !newVoices.some(nvn => nvn.name === voice.name)).map(voice => voice.name);

    // Then build the new data array
    let voices = startingVoices.filter(voice => !voice.languageCodes.some(lc => !langCode || langCode === "all" || lc.startsWith(langCode)));
    voices.push(...newVoices);
    voices = voices.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    try {
      this._db.push("/voices", voices, true);
      this._setWriteTimeout(10 * 1000);
    } catch (err) {
      const logger = new ContextLogger("gcptts.data.replaceVoices");
      logger.warnEx("Failed to push to database, or save it to file", err as Error, err as Error);
    }
    return result;
  }

  /**
   * Get the language/locale information from the provided voice name.
   * @param voiceName The name of the voice to get the language code from.
   * @returns The language and locale code, as well as the plain-text English description of that langCode.
   */
  voiceLocaleInfo(voiceName: string): LocaleInfo | null {
    const voice = this.getVoiceInfo(voiceName);
    if (voice && voice.languageCodes.length > 0) {
      return this.getLocaleInfo(voice.languageCodes[0]);
    }
    return null;
  }

  /**
   * Get the pricing tier of the specified voice.
   * @param voiceName The name of the voice to get the pricing tier enumeration from.
   * @returns An EVoicePricingTier enumeration with the pricing tier of the specified voice.
   */
  voicePricing(voiceName: string): VoicePricingTier {
    if (voiceName.includes("Casual")) {
      // TODO: Not sure of the actual pricing tier for casual, but only news voices currently go up to K, so maybe that's correct?
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

  /**
   * Get the synthesizer technology utilized by the specified voice.
   * @param voiceName The name of the voice to get the synthesizer technology enumeration from.
   * @returns An EVoiceTechnology detailing the synthesize technology utilized by the specified voice.
   */
  voiceType(voiceName: string): VoiceType {
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

  private _setWriteTimeout(maxAcceptableDelayInSeconds: number): void {
    const nowMs = new Date().getUTCMilliseconds();
    const oldDeadlineMs = this._writeDeadlineUtcMs ? this._writeDeadlineUtcMs : Number.MAX_SAFE_INTEGER;
    maxAcceptableDelayInSeconds = Math.max(maxAcceptableDelayInSeconds, 0);

    // flush now.
    if (maxAcceptableDelayInSeconds <= 0 || oldDeadlineMs < nowMs) {
      if (this._writeTimeout) {
        clearTimeout(this._writeTimeout);
      }
      this._writeDeadlineUtcMs = null;
      this._writeTimeout = null;
      this.flush();
      return;
    }

    const newDeadlineMs = maxAcceptableDelayInSeconds * 1000 + nowMs;

    // new deadline wins out, tee it up
    if (Math.min(newDeadlineMs, oldDeadlineMs) < oldDeadlineMs) {
      if (this._writeTimeout) {
        clearTimeout(this._writeTimeout);
      }
      this._writeDeadlineUtcMs = new Date(newDeadlineMs).getUTCMilliseconds();
      this._writeTimeout = setTimeout(() => {
        this.flush();
      }, newDeadlineMs - nowMs);
    }
  }
}
