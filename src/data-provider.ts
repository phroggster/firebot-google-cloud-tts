import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import fs from "fs";
import fsp from "fs/promises";

import { ContextLogger } from "./context-logger";
import {
  EVoicePricingTier,
  EVoiceTechnology,
  ExtendedVoiceInfo,
  IDataProvider,
  LocaleInfo,
  LocalesInfo,
  VoiceInfo,
  VoicesInfo,
} from "./types";

import localesJson from "../data/locales.json";
import voicesJson from "../data/voices.json";

type VoiceSelectorParams = {
  langCode?: string;
  name?: string;
  pricing?: string;
  technology?: string;
};

const logger = new ContextLogger("data");
const localesFileName = "locales.json";
// const settingsFileName = "settings.json";
const voicesFileName = "voices.json";

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
  private _localesFilePath: string;
  // TODO: private _settingsFilePath: string;
  private _voicesFilePath: string;

  constructor(dataFolder: string, path: ScriptModules["path"]) {
    this._localesFilePath = path.join(dataFolder, localesFileName);
    this._voicesFilePath = path.join(dataFolder, voicesFileName);

    setTimeout(() => {
      if (!fs.existsSync(dataFolder)) {
        try {
          fs.mkdirSync(dataFolder, { mode: 0o755, recursive: true });
          logger.debug("Created persistent data folder");
        } catch (err) {
          logger.exception(`Failed to create persistent data folder at "${dataFolder}"`, err as Error);
        }
      }

      if (!fs.existsSync(this._localesFilePath)) {
        try {
          fs.writeFileSync(this._localesFilePath, JSON.stringify(localesJson, null, 2), { encoding: "utf-8", flush: true, mode: 0o644 });
          logger.debug("Created persistent locales data file");
        } catch (err) {
          logger.exception(`Failed to write locale data to "${this._localesFilePath}"`, err as Error);
        }
      }

      if (!fs.existsSync(this._voicesFilePath)) {
        try {
          fs.writeFileSync(this._voicesFilePath, JSON.stringify(voicesJson, null, 2), { encoding: "utf-8", flush: true, mode: 0o644 });
          logger.debug("Created persistent voices data file");
        } catch (err) {
          logger.exception(`Failed to write voice data "${this._voicesFilePath}"`, err as Error);
        }
      }

      logger.debug("Finished initialization");
    }, 2000);
  }

  async getAllLocales(): Promise<LocaleInfo[]> {
    try {
      const jsonLocales = await fsp.readFile(this._localesFilePath, { encoding: "utf-8", flag: "r" });
      return ((JSON.parse(jsonLocales) as LocalesInfo) ?? (localesJson as LocalesInfo))?.locales ?? [];
    } catch (err) {
      logger.exception(`Failed to read locales data from "${this._localesFilePath}"`, err as Error);
    }
    return [];
  }

  getAllLocalesSync(): LocaleInfo[] {
    try {
      const jsonLocales = fs.readFileSync(this._localesFilePath, { encoding: "utf-8", flag: "r" });
      return ((JSON.parse(jsonLocales) as LocalesInfo) ?? (localesJson as LocalesInfo))?.locales ?? [];
    } catch (err) {
      logger.exception(`Failed to synchronously read locales data from "${this._localesFilePath}"`, err as Error);
    }
    return [];
  }

  async getAllVoices(): Promise<VoiceInfo[]> {
    try {
      const jsonVoices = await fsp.readFile(this._voicesFilePath, { encoding: "utf-8", flag: "r" });
      return ((JSON.parse(jsonVoices) as VoicesInfo) ?? (voicesJson as VoicesInfo))?.voices ?? [];
    } catch (err) {
      logger.exception(`Failed to read voices data from "${this._voicesFilePath}"`, err as Error);
    }
    return [];
  }

  getAllVoicesSync(): VoiceInfo[] {
    try {
      const jsonVoices = fs.readFileSync(this._voicesFilePath, { encoding: "utf-8", flag: "r" });
      return ((JSON.parse(jsonVoices) as VoicesInfo) ?? (voicesJson as VoicesInfo))?.voices ?? [];
    } catch (err) {
      logger.exception(`Failed to read voices data synchronously from "${this._voicesFilePath}"`, err as Error);
    }
    return [];
  }

  async getExtendedVoiceInfo(voiceSelector?: VoiceSelectorParams): Promise<ExtendedVoiceInfo[]> {
    const locales = await this.getAllLocales();
    let voices = await this.getAllVoices();

    if (voiceSelector !== undefined && voiceSelector.name !== undefined) {
      const vsName = voiceSelector.name.toLowerCase();
      voices = voices.filter(voice => voice.name.toLowerCase() === vsName);
    } else if (voiceSelector !== undefined && voiceSelector.langCode !== undefined) {
      const vsLang = voiceSelector.langCode.toLowerCase();
      voices = voices.filter(voice => voice.name.toLowerCase().startsWith(vsLang));
    }

    return voices
      .map((voice) => {
        return {
          ...voice,
          locInfo: this._getVoiceLocaleInfo(voice.name, locales),
        };
      })
      .filter(voice => voice.locInfo !== null)
      .map((voice) => {
        return {
          gender: voice.ssmlGender,
          language: voice.locInfo?.desc ?? "",
          languageCode: voice.locInfo?.id ?? "",
          name: voice.name,
          pricing: this.getVoicePricingTier(voice.name),
          sampleRate: voice.naturalSampleRateHertz,
          technology: this.getVoiceTechnology(voice.name),
        };
      });
  }

  async getVoiceLanguage(voiceName: string): Promise<LocaleInfo | null> {
    const locales = await this.getAllLocales();
    return this._getVoiceLocaleInfo(voiceName, locales);
  }

  getVoiceLanguageSync(voiceName: string): LocaleInfo | null {
    const locales = this.getAllLocalesSync();
    return this._getVoiceLocaleInfo(voiceName, locales);
  }

  getVoicePricingTier(voiceName: string): EVoicePricingTier {
    if (!voiceName) {
      return EVoicePricingTier.Unknown;
    } else if (voiceName.includes("Casual")) {
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

  getVoiceTechnology(voiceName: string): EVoiceTechnology {
    if (!voiceName) {
      return EVoiceTechnology.Unknown;
    }

    return Object.values(EVoiceTechnology).find((tech) => {
      return voiceName.toLowerCase().includes(tech.toLowerCase());
    }) || EVoiceTechnology.Unknown;
  }


  async replaceAllVoices(_: VoiceInfo[]): Promise<void> {
    // TODO:
    throw new Error("Method not implemented.");
  }

  async updateVoices(_: VoiceInfo[]): Promise<void> {
    // TODO:
    throw new Error("Method not implemented.");
  }


  private _getVoiceLocaleInfo(voiceName: string, locales: LocaleInfo[]): LocaleInfo | null {
    return locales.find(locale => voiceName.toLowerCase().startsWith(locale.id.toLowerCase())) || null;
  }
}
