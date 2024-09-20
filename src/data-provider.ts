import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import fs from "fs";

import { ContextLogger } from "./context-logger";
import {
  ESsmlVoiceGender,
  EVoicePricingTier,
  EVoiceTechnology,
  ExtendedVoiceInfo,
  IDataProvider,
  LocaleInfo,
  VoiceInfo,
  VoiceSelectorParams,
} from "./types";

import localesJson from "../data/locales.json";
import voicesJson from "../data/voices.json";
import { folders } from "./main";

type UpdateCheckData = {
  plugin?: Date,
  voices?: Date,
};
type PluginDataModel = {
  lastChecks?: UpdateCheckData,
  locales: LocaleInfo[],
  voices: VoiceInfo[],
};

const dataFileName = "gttsdata.json";
const logger = new ContextLogger("data");
const writeDelaySeconds = 10 * 1000;

/**
 * A repository for maintaining the data files and settings that the plugin utilizes.
 *
 * JSON data for the plugin is included in the webpack, but this data can and will be updated at
 * runtime either manually through an effect or automatically. So this class will simply
 * de/serialize such data from/to the plugin's data directory.
 *
 * It will not retain data in-memory, and everything about it is designed to be async to/from disk.
 */
export class DataProvider implements IDataProvider {
  private _data: PluginDataModel;
  private readonly _dataFilePath: string;
  private _writeTimeout?: NodeJS.Timeout;

  /**
   * Constructs a new DataProvider persisting data in the specified path.
   * @param dataFolder The location on-disk of where to store any data files.
   * @param path A helper utility for safely concatenating filesystem paths.
   */
  constructor(dataFolder: string, path: ScriptModules["path"]) {
    this._dataFilePath = path.join(dataFolder, dataFileName);
    this._writeTimeout = undefined;

    // Pre-fill storage cache from compiled data.
    this._data = {
      lastChecks: undefined,
      locales: localesJson.locales,
      voices: voicesJson.voices as VoiceInfo[],
    };

    // Then either load it immediately, or queue a write for later.
    if (fs.existsSync(this._dataFilePath)) {
      this._readDataFile();
    } else {
      this._writeTimeout = setTimeout(() => this._writeDataFile(), writeDelaySeconds);
    }
  }

  /** Get the date that we last checked github for updates to this plugin. */
  get lastUpdateCheck(): Date | null {
    return this._data.lastChecks?.plugin ?? null;
  }
  /** Set the date that we last checked github for updates to this plugin. */
  set lastUpdateCheck(date: Date | null) {
    if (this._data.lastChecks !== undefined) {
      if (date !== null) {
        this._data.lastChecks.plugin = date;
      } else if (this._data.lastChecks.voices === undefined) {
        this._data.lastChecks = undefined;
      } else {
        this._data.lastChecks.plugin = undefined;
      }
    } else if (date !== null) {
      this._data.lastChecks = { plugin: date };
    } else {
      // lastChecks is undefined and date param is null.
      return;
    }

    if (this._writeTimeout !== undefined) {
      clearTimeout(this._writeTimeout);
    }

    this._writeTimeout = setTimeout(() => this._writeDataFile(), writeDelaySeconds);
  }

  /** Get the date that we last pulled the voices list from Google's TTS API. */
  get lastVoiceUpdate(): Date | null {
    return this._data.lastChecks?.voices ?? null;
  }
  /** Set the date that we last pull the voices list from Google's TTS API. */
  set lastVoiceUpdate(date: Date | null) {
    if (this._data.lastChecks !== undefined) {
      if (date !== null) {
        this._data.lastChecks.voices = date;
      } else if (this._data.lastChecks.plugin === undefined) {
        this._data.lastChecks = undefined;
      } else {
        this._data.lastChecks.voices = undefined;
      }
    } else if (date !== null) {
      this._data.lastChecks = { voices: date };
    } else {
      // lastChecks is undefined and date param is null.
      return;
    }

    if (this._writeTimeout !== undefined) {
      clearTimeout(this._writeTimeout);
    }

    this._writeTimeout = setTimeout(() => this._writeDataFile(), writeDelaySeconds);
  }

  /** Get a list of known locale information, such as [ id: "en-US", desc: "English (United States)" ]. */
  get locales(): LocaleInfo[] {
    return this._data.locales;
  }
  /** Set the list of known locale information, such as [ id: "en-US", desc: "English (United States)" ]. */
  set locales(locales: LocaleInfo[]) {
    if (this._writeTimeout !== undefined) {
      clearTimeout(this._writeTimeout);
      this._writeTimeout = undefined;
    }

    this._data.locales = locales.filter(loc => loc.desc !== "" && loc.id !== "");

    this._writeTimeout = setTimeout(() => this._writeDataFile(), writeDelaySeconds);
  }

  /** Get a list of known Google TTS voices. */
  get voices(): VoiceInfo[] {
    return this._data.voices;
  }
  /** Set the list of known Google TTS voices. */
  set voices(voices: VoiceInfo[]) {
    if (this._writeTimeout !== undefined) {
      clearTimeout(this._writeTimeout);
      this._writeTimeout = undefined;
    }

    // The neutral enum value is marked as deprecated, so use a string to filter it out instead.
    this._data.voices = voices.filter(voice =>
      voice.languageCodes.length > 0 &&
      voice.name !== "" &&
      voice.naturalSampleRateHertz > 5512 && voice.naturalSampleRateHertz < 768000 &&
      // eslint-disable-next-line comma-dangle
      voice.ssmlGender !== "NEUTRAL"
    );

    this._writeTimeout = setTimeout(() => this._writeDataFile(), writeDelaySeconds);
  }


  /**
   * Get the language details of the specified voice.
   * @param voiceName The name of the voice to get the language code from.
   * @returns The language and locale code, as well as the plain-text English description of that langCode.
   */
  language(voiceName: string): LocaleInfo | undefined {
    return this._data.locales.find(locale => voiceName.toLowerCase().startsWith(locale.id.toLowerCase()));
  }

  /**
   * Get the pricing tier of the specified voice.
   * @param voiceName The name of the voice to get the pricing tier enumeration from.
   * @returns An EVoicePricingTier enumeration with the pricing tier of the specified voice.
   */
  pricingTier(voiceName: string): EVoicePricingTier {
    if (voiceName.includes("Casual")) {
      // TODO: Not sure of the pricing tier for casual, but only news voices currently go up to K, so maybe that's correct?
      return EVoicePricingTier.Studio;
    } else if (voiceName.includes("Journey")) {
      return EVoicePricingTier.Journey;
    } else if (voiceName.includes("Neural2")) {
      return EVoicePricingTier.Neural2;
    } else if (voiceName.includes("News")) {
      return EVoicePricingTier.Studio;
    } else if (voiceName.includes("Polyglot")) {
      return EVoicePricingTier.Polyglot;
    } else if (voiceName.includes("Standard")) {
      return EVoicePricingTier.Standard;
    } else if (voiceName.includes("Studio")) {
      return EVoicePricingTier.Studio;
    } else if (voiceName.includes("Wavenet")) {
      return EVoicePricingTier.WaveNet;
    }
    return EVoicePricingTier.Unknown;
  }

  /**
   * Get the synthesizer technology utilized by the specified voice.
   * @param voiceName The name of the voice to get the synthesizer technology enumeration from.
   * @returns An EVoiceTechnology detailing the synthesize technology utilized by the specified voice.
   */
  technology(voiceName: string): EVoiceTechnology {
    const lname = voiceName.toLowerCase();
    return Object.values(EVoiceTechnology).find((tech) => {
      return lname.includes(tech.toLowerCase());
    }) || EVoiceTechnology.Unknown;
  }

  /**
   * Get all available information about a selection of Google TTS voices.
   * @param voiceSelector
   * @returns Selection criteria for the voice(s) to return. Filter by gender, language code, voice name, pricing, or technology.
   */
  voiceInfo(voiceSelector?: VoiceSelectorParams): ExtendedVoiceInfo[] {
    // This isn't designed for filtering from the frontend. It's designed for some use case that I haven't come up with yet.
    // But I guess it probably would be superb inside of a $ctrl.onInit().
    let voices: ExtendedVoiceInfo[] | VoiceInfo[] = this._data.voices;

    // VoiceInfo filters first, as those are cheap, and it will save pointless locale, pricing, and tech lookups.
    if (voiceSelector !== null && voiceSelector !== undefined) {
      if (voiceSelector.gender !== null && voiceSelector.gender !== undefined) {
        const gender = voiceSelector.gender;
        voices = voices.filter(voice => voice.ssmlGender === gender);
      }

      if (voiceSelector.langCode !== null && voiceSelector.langCode !== undefined && voiceSelector.langCode !== "") {
        const llang = voiceSelector.langCode.toLowerCase();
        voices = voices.filter(voice => voice.languageCodes.some(vlc => vlc.toLowerCase().includes(llang)));
      }

      if (voiceSelector.name !== null && voiceSelector.name !== undefined && voiceSelector.name !== "") {
        const vname = voiceSelector.name.toLowerCase();
        voices = voices.filter((voice) => {
          const lname = voice.name.toLowerCase();
          return lname === vname || lname.includes(vname);
        });
      }
    }

    // Then build up ExtendedVoiceInfo
    voices = voices
      .map((voice) => {
        return {
          ...voice,
          locInfo: this._getVoiceLocale(voice.name),
        };
      }).filter(voiceExt => voiceExt.locInfo !== null)
      .map((vocWithLoc) => {
        return {
          gender: vocWithLoc.ssmlGender,
          language: vocWithLoc.locInfo?.desc ?? "",
          languageCode: vocWithLoc.locInfo?.id ?? "",
          name: vocWithLoc.name,
          pricing: this.pricingTier(vocWithLoc.name),
          sampleRate: vocWithLoc.naturalSampleRateHertz,
          technology: this.technology(vocWithLoc.name),
        };
      });

    // Finish things up with the ExtendedVoiceInfo filters.
    if (voiceSelector !== null && voiceSelector !== undefined) {
      if (voiceSelector.pricing !== null && voiceSelector.pricing !== undefined) {
        const pricing = voiceSelector.pricing;
        voices = voices.filter(voice => voice.pricing === pricing);
      }

      if (voiceSelector.technology !== null && voiceSelector.technology !== undefined) {
        // Vroom vroom.
        const vtech = voiceSelector.technology;
        voices = voices.filter(voice => voice.technology === vtech);
      }
    }

    return voices;
  }


  private _getVoiceLocale(voiceName: string): LocaleInfo | null {
    const lname = voiceName.toLowerCase();
    return this._data.locales.find(locale => lname.startsWith(locale.id.toLowerCase())) || null;
  }

  private _readDataFile(): boolean {
    type NullableLocaleInfo = {
      id?: string | null;
      desc?: string | null;
    };
    type NullableUpdatesData = {
      plugin?: Date | null,
      voices?: Date | null,
    };
    type NullableVoiceInfo = {
      languageCodes?: string[] | null;
      name?: string | null;
      ssmlGender?: ESsmlVoiceGender | null;
      naturalSampleRateHertz?: number | null;
    }
    type NullablePluginDataModel = {
      lastChecks?: NullableUpdatesData | null,
      locales?: NullableLocaleInfo[] | null,
      voices?: NullableVoiceInfo[] | null,
    };

    if (!fs.existsSync(this._dataFilePath)) {
      return false;
    }

    let fileContents: string;
    try {
      fileContents = fs.readFileSync(this._dataFilePath, { encoding: "utf-8" });
    } catch (err) {
      logger.exception(`Failed to read plugin data store from "${this._dataFilePath}"`, err as Error);
      return false;
    }

    if (!fileContents) {
      logger.error(`Failed to read plugin data store from "${this._dataFilePath}"`);
      return false;
    }

    let dataStore: NullablePluginDataModel;
    try {
      dataStore = (JSON.parse(fileContents) as NullablePluginDataModel);
    } catch (err) {
      logger.exception(`Failed to parse plugin data store from "${this._dataFilePath}"`, err as Error);
      return false;
    }

    if (!dataStore) {
      logger.warn(`Failed to parse plugin data store from "${this._dataFilePath}"`);
      return false;
    }


    if (dataStore.lastChecks && (dataStore.lastChecks.plugin || dataStore.lastChecks.voices)) {
      if (this._data.lastChecks === undefined) {
        this._data.lastChecks = {};
      }
      if (dataStore.lastChecks.plugin) {
        this._data.lastChecks.plugin = dataStore.lastChecks.plugin;
      }
      if (dataStore.lastChecks.voices) {
        this._data.lastChecks.voices = dataStore.lastChecks.voices;
      }
    }

    if (dataStore.locales && dataStore.locales.length > 0) {
      this._data.locales = dataStore.locales.filter(loc => loc && loc.desc && loc.id) as LocaleInfo[];
    }

    if (dataStore.voices != null && dataStore.voices.length > 0) {
      this._data.voices = dataStore.voices.filter(voice => voice && voice.languageCodes && voice.languageCodes.length > 0 && voice.name && voice.naturalSampleRateHertz && voice.ssmlGender) as VoiceInfo[];
    }

    logger.debug(`Loaded data store from "${this._dataFilePath}"`);
    return true;
  }

  private _writeDataFile(): boolean {
    this._writeTimeout = undefined;

    if (folders === null || folders.dataDir.length === 0) {
      logger.error("Unknown data storage location, unable to write data file");
      return false;
    }

    if (!fs.existsSync(folders.dataDir)) {
      try {
        fs.mkdirSync(folders.dataDir, { mode: 0o755, recursive: true });
        logger.debug("Created persistent data folder");
      } catch (err) {
        logger.exception(`Failed to create persistent data folder at "${folders.dataDir}", will be unable to write data`, err as Error);
        return false;
      }
    }

    try {
      fs.writeFileSync(this._dataFilePath, JSON.stringify(this._data, null, 2), { encoding: "utf-8", flush: true, mode: 0o644 });
      logger.debug("Wrote persistent plugin data file");
      return true;
    } catch (err) {
      this._writeTimeout = setTimeout(() => this._writeDataFile(), 30000);
      logger.exception(`Failed to persist plugin data to "${this._dataFilePath}", will try again in 30 seconds`, err as Error);
      return false;
    }
  }
}
