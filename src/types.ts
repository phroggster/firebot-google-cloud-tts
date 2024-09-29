/** The genders that a voice could be categorized as using. */
export type SsmlVoiceGender = "FEMALE" | "MALE" | "SSML_VOICE_GENDER_UNSPECIFIED" | "NEUTRAL";
type SsmlVoiceGenderNoNeutral = "FEMALE" | "MALE" | "SSML_VOICE_GENDER_UNSPECIFIED";

/** The pricing tiers that a voice synthesis request will get you billed for. */
export type VoicePricingTier = "Unknown" | "Standard" | "Wavenet" | "Neural2" | "Polyglot" | "Journey" | "Studio";

/** The type of voice model. */
export type VoiceType = VoicePricingTier | "Casual" | "News";

/** All of the information available about a specific voice. */
export interface ExtendedVoiceInfo extends Record<string, string | number> {
  /** The gender that the voice is categorized as using, such as "FEMALE". */
  gender: SsmlVoiceGenderNoNeutral;
  /** The BCP-47 lang-LOCALE tag that the voice supports, such as "en-US". */
  languageCode: string;
  /** The human-readable language that the voice supports in English, such as "English (United States)". */
  languageName: string;
  /** The name of the voice, such as "en-US-Wavenet-C". */
  name: string;
  /** The pricing model of the voice, such as "Journey" */
  pricing: VoicePricingTier;
  /** The natural sampling rate preferred by the voice. Generally, this will always be `24000` hz. */
  sampleRate: number;
  /** The type of speech supported by the voice model, such as "News". */
  type: VoiceType;
};

/** An object containing information about a language and potentially a locale. */
export type LocaleInfo = {
  /** A BCP-47 language and likely locale code, e.g. "en-US", or possibly "en". Will never contain more than two parts (lang-LOCALE). */
  id: string;
  /** The English name of the entry, e.g. "English (United States)", or "English". */
  name: string;
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
  ssmlGender: SsmlVoiceGender;
  /** The preferred audio sampling rate of the voice, in hertz, or samples per second. Typically, 24000. */
  naturalSampleRateHertz: number;
};

/**  An object representing an array of Google Text-to-Speech voices, as serialized to/from voices.json, or retrieved from the Google API. */
export type VoicesInfo = {
  /** An array of VoiceInfo objects. */
  voices: VoiceInfo[];
};

/** Parameters used by the firebot-google-tts-revised plugin. */
export interface IPluginParams extends Record<string, unknown> {
  /** How often should the script check for new updates. */
  pluginUpdateCheckInterval: "Never" | "OnStart" | "Daily" | "TwoDays" | "ThreeDays" | "Weekly" | "TwoWeeks" | "Monthly";
  /** How often should the script check for voice list updates. */
  voiceUpdateCheckInterval: "Never" | "OnStart" | "Daily" | "TwoDays" | "ThreeDays" | "Weekly" | "TwoWeeks" | "Monthly";
};

export interface IGetVoicesEventData {
  langCode?: string;
  voiceName?: string;
  voiceType?: string;
};
