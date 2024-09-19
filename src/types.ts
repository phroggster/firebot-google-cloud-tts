import {
  CustomScriptManifest,
  ScriptModules,
} from "@crowbartools/firebot-custom-scripts-types";
import { FirebotSettings } from "@crowbartools/firebot-custom-scripts-types/types/settings";
import { TypedEmitter } from "tiny-typed-emitter";

/**
 * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig#AudioEncoding
 * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/AudioConfig#AudioEncoding
 */
export enum EAudioEncoding {
  /** Not specified. Will throw an INVALID_ARGUMENT error if provided to a synthesis request. */
  unspecified = "AUDIO_ENCODING_UNSPECIFIED",
  /** Uncompressed 16-bit signed linear PCM audio data, packaged with a WAV file header. */
  linear16 = "LINEAR16",
  /** MP3-encoded (MPEG audio layer 3) audio data at 32kbps. */
  mp3 = "MP3",
  /** (v1beta1 only) MP3-encoded (MPEG audio layer 3) audio data at 64kbps. */
  mp364 = "MP3_64_KBPS",
  /** Opus-encoded audio wrapped in an ogg container. The quality of the encoding is considerably higher than Mp3 while using approximately the same bitrate. */
  oggopus = "OGG_OPUS",
  /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/mu-law, packaged with a WAV file header. */
  mulaw = "MULAW",
  /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/A-law, packaged with a WAV file header. */
  alaw = "ALAW"
};

/** @see https://cloud.google.com/text-to-speech/docs/audio-profiles#available_audio_profiles */
export enum EAudioProfile {
  /** Smart watches and other wearables, like Apple Watch, Wear OS watch. */
  wearable = "wearable-class-device",
  /** Smartphones, like Google Pixel, Samsung Galaxy, Apple iPhone. */
  handset = "handset-class-device",
  /** Earbuds or headphones for audio playback, like Sennheiser headphones. */
  headphone = "headphone-class-device",
  /** Small home speakers, like Google Home Mini. */
  smallbt = "small-bluetooth-speaker-class-device",
  /** Smart home speakers, like Google Home. */
  medbt = "medium-bluetooth-speaker-class-device",
  /** Home entertainment systems or smart TVs, like Google Home Max, LG TV. */
  homeent = "large-home-entertainment-class-device",
  /** Car speakers. */
  auto = "large-automotive-class-device",
  /** Interactive Voice Response (IVR) systems. */
  telephony = "telephony-class-application"
};

/** @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/SsmlVoiceGender */
export enum ESsmlVoiceGender {
  Unknown = "SSML_VOICE_GENDER_UNSPECIFIED",
  Female = "FEMALE",
  Male = "MALE",
  /** @deprecated */
  Neutral = "NEUTRAL"
};

/** Options controlling how often the plugin will check for external updates. */
export enum EUpdateCheckFrequency {
  /** Never automatically check for updates in the background, but allow update checks to manually occur when the effects to do so are triggered. */
  Never = "Never",
  /** Check for updates in the background only when Firebot is starting up while the script is being loaded. */
  OnStart = "OnStart",
  /** Check for updates in the background once per day. */
  Daily = "Daily",
  /** Check for updates in the background once per week. */
  Weekly = "Weekly",
  /** Check for updates in the background once per month. */
  Monthly = "Monthly"
};

/** Voice model pricing tiers. */
export enum EVoicePricingTier {
  // string values *must* match the capitalization of the voice names provided from Google. e.g. "Wavenet", not "WaveNet".

  /** An unknown or unavailable voice pricing tier. Generally used to indicate a problem. */
  Unknown = "Unknown",
  /** Standard voice technology pricing. The least expensive option, currently at $4 USD per 1M characters. */
  Standard = "Standard",
  /** WaveNet voice technology pricing. Currently at $16 USD per 1M characters. */
  WaveNet = "Wavenet",
  /** Neural2 voice technology pricing. Currently at $16 USD per 1M bytes. */
  Neural2 = "Neural2",
  /** (Preview) Polyglot voice technology pricing tier. Currently at $16 USD per 1M bytes. */
  Polyglot = "Polyglot",
  /** (Preview) Journey voice technology pricing tier. Currently at $30 USD per 1M bytes. */
  Journey = "Journey",
  /** Studio voice technology pricing tier. The most expensive option, currently at $160 USD per 1M bytes. */
  Studio = "Studio"
};

/** Voice technology models. */
export enum EVoiceTechnology {
  /** An unknown or unavailable voice technology. Generally used to indicate a problem. */
  Unknown = "Unknown",
  /** The most basic voice technology that likely uses a vocoder algorithm. Is very much capable of saying words, but can be painful to listen to for extended periods as it entirely lacks emotion. */
  Standard = "Standard",
  /** The entry-level premium voice technology that sounds significantly more natural than the Standard voice technology. */
  WaveNet = "Wavenet",
  /** The technology behind Google's custom programmable text-to-speech voices. Excellent mid-grade voice quality at a reasonable price. Perfect for reading your TTS messages live on-stream. */
  Neural2 = "Neural2",
  /** (Preview) A Neural2 voice that is capable of being used in multiple languages. */
  Polyglot = "Polyglot",
  /** (Preview) A Neural2 voice with imperfect dialog designed for natural cadence and tone. Supports disfluencies (e.g. "oh", "uh", "um", and "mhm"). Perfect for chatting with your buds. */
  Casual = "Casual",
  /** (Preview) Engaging and empthatetic voice technology designed for conversations. Perfect for virtual assistants, custom service chatbots, sales calls, and story time. */
  Journey = "Journey",
  /** Narration voice designed for news reading and broadcast content. Perfect for replacing your press secretary, or announcing major events. */
  Studio = "Studio",
};



/** All of the information available about a specific voice. */
export type ExtendedVoiceInfo = {
  /** The gender that the voice is categorized as using, such as "FEMALE". */
  gender: ESsmlVoiceGender;
  /** The human-readable language that the voice supports in English, such as "English (United States)". */
  language: string;
  /** The BCP-47 lang-LOCALE tag that the voice supports, such as "en-US". */
  languageCode: string;
  /** The name of the voice, such as "en-US-Wavenet-C". */
  name: string;
  /** The pricing model of the voice, such as "Wavenet" */
  pricing: EVoicePricingTier;
  /** The natural sampling rate preferred by the voice. Generally, this will always be `24000` hz. */
  sampleRate: number;
  /** The technology supported by the voice model, such as "Wavenet". */
  technology: EVoiceTechnology;
};

/** An object containing information about a language and potentially a locale. */
export type LocaleInfo = {
  /** A BCP-47 language and likely locale code, e.g. "en-US", or possibly "en". Will never contain more than two parts (lang-LOCALE). */
  id: string;
  /** The English description of the entry, e.g. "English (United States)", or "English". */
  desc: string;
};

/** An object representing an array of locale information objects, as serialized to/from locales.json. */
export type LocalesInfo = {
  /** An array of LocaleInfo objects. */
  locales: LocaleInfo[];
};

/** An object representing information about a Google Text-to-Speech voice. */
export type VoiceInfo = {
  /** The BCP-47 language (and locale) tags supported by the voice. */
  languageCodes: string[];
  /** The unique name identifying the voice. */
  name: string;
  /** The gender associated with the voice. */
  ssmlGender: ESsmlVoiceGender;
  /** The preferred audio sampling rate of the voice, in hertz, or samples per second. Typically, 24000. */
  naturalSampleRateHertz: number;
};

/**  An object representing an array of Google Text-to-Speech voices, as serialized to/from voices.json, or retrieved from the Google API. */
export type VoicesInfo = {
  /** An array of VoiceInfo objects. */
  voices: VoiceInfo[];
};

type VoiceSelectorParams = {
  langCode?: string;
  name?: string;
  pricing?: string;
  technology?: string;
};

/** Plugin data de/serialization provider. */
export interface IDataProvider {
  getAllLocales(): Promise<LocaleInfo[]>;
  getAllLocalesSync(): LocaleInfo[];
  getAllVoices(): Promise<VoiceInfo[]>;
  getAllVoicesSync(): VoiceInfo[];
  getExtendedVoiceInfo(voiceSelector?: VoiceSelectorParams | null): Promise<ExtendedVoiceInfo[]>;
  getVoiceLanguage(voiceName: string): Promise<LocaleInfo | null>;
  getVoiceLanguageSync(voiceName: string): LocaleInfo | null;
  getVoicePricingTier(voiceName: string): EVoicePricingTier;
  getVoiceTechnology(voiceName: string): EVoiceTechnology;

  replaceAllVoices(voices: VoiceInfo[]): Promise<void>;
  updateVoices(voices: VoiceInfo[]): Promise<void>;
};


/** Parameters used by the firebot-google-tts-revised plugin. */
export interface IPluginParams extends Record<string, unknown> {
  /** How often should the script check for new updates. */
  pluginUpdateCheckInterval: EUpdateCheckFrequency;
  /** How often should the script check for voice list updates. */
  voiceUpdateCheckInterval: EUpdateCheckFrequency;
};

/** Various folder paths used by the firebot-google-tts-revised plugin. */
export type PluginFolders = {
  /** The path to this script's data directory where ancillary script data (voice list updates) will be saved. */
  dataDir: string;
  /** The path to the temporary folder where audio files will be downloaded to and played from. */
  tmpDir: string;
}
