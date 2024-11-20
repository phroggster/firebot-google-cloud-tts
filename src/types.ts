const valueNamesArray = <T extends string[]>(...args: T) => args;

/** An array of the value names for the SsmlVoiceGender value type. */
export const ssmlVoiceGenderValueNames = valueNamesArray(
  "FEMALE",
  "MALE",
  "SSML_VOICE_GENDER_UNSPECIFIED",
  "NEUTRAL",
);
/** The genders that a voice could be categorized as using. */
export type SsmlVoiceGender = (typeof ssmlVoiceGenderValueNames)[number];

/** An array of the value names for the SsmlVoiceGenderNoNeutral value type. */
export const ssmlVoiceGenderNoNeutralValueNames = valueNamesArray(
  "FEMALE",
  "MALE",
  "SSML_VOICE_GENDER_UNSPECIFIED",
);
/** The genders that a voice could be categorized as using, excluding "NEUTRAL",
 * which is disallowed in synthesis requests.
 */
export type SsmlVoiceGenderNoNeutral =
  (typeof ssmlVoiceGenderNoNeutralValueNames)[number];

/** An array of the value names for the UpdateCheckInterval value type. */
export const updateIntervalValueNames = valueNamesArray(
  "Never",
  "OnStart",
  "TwiceDaily",
  "Daily",
  "TwoDays",
  "ThreeDays",
  "Weekly",
  "TwoWeeks",
  "Monthly",
);
/** Various intervals for how often updates should be performed. */
export type UpdateCheckInterval = (typeof updateIntervalValueNames)[number];

/** An array of the value names for the VoicePricingTier value type. */
export const voicePricingTierValueNames = valueNamesArray(
  "Unknown",
  "Standard",
  "Wavenet",
  "Neural2",
  "Polyglot",
  "Journey",
  "Studio",
);
/** The pricing tiers that a Google Text-to-Speech voice can utilize.
 * @see https://cloud.google.com/text-to-speech/pricing
 */
export type VoicePricingTier = (typeof voicePricingTierValueNames)[number];

/** An array of the value names for the VoiceStyle value type. */
export const voiceStyleValueNames = valueNamesArray(
  "Unknown",
  "Casual",
  "Journey",
  "Neural2",
  "News",
  "Polyglot",
  "Standard",
  "Studio",
  "Wavenet",
);
/** The style of speech that a voice will produce.
 * @see https://cloud.google.com/text-to-speech/docs/voice-types
 */
export type VoiceStyle = (typeof voiceStyleValueNames)[number];


/** Parameters used by the firebot-google-tts-revised custom plugin. */
export interface PluginParams extends Record<string, unknown> {
  /** Whether or not plugin updates should automatically be installed when they
   * are available.
   */
  autoUpgrade: boolean;
  /** How often should the plugin check for new updates. */
  pluginUpdateCheckInterval: UpdateCheckInterval;
  /** How often should the plugin check for voice list updates. */
  voicesUpdateInterval: UpdateCheckInterval;
};

export interface ReadonlyPluginParams {
  readonly autoUpgrade: boolean;
  readonly pluginUpdateCheckInterval: UpdateCheckInterval;
  readonly voicesUpdateInterval: UpdateCheckInterval;
};

/** The common, base, interface of integration parameters provided by this
 * custom plugin.
 */
export interface BaseGcpIntegrationParams
  extends Record<string, Record<string, unknown>>
{
  connection: {
    /** Optional, ?maybe? required for "Web Application" OAuth flows. An HTTP
     * referer [*sic*] header can limit requests accepted from the credentials.
     * This can enable some tighter control of credentials over the
     * "Desktop Application" OAuth flow.
     */
    referrer?: string,
    /** Optional. An user-agent string to append onto the
     * "Firebot/{fb version} firebot-gcp-tts/{plugin version}" that is
     * supplied. User agents aren't seemingly tracked in the GCP
     * text-to-speech API by default, unless you hook up additional monitoring
     * APIs in the GCP console, or perhaps do long-form TTS requests.
     *
     * This does not add any additional security, it adds *at best* client
     * instance billing isolation.
     */
    userAgent?: string,
  },
};



/** All of the information available about a specific voice. */
export interface ExtendedVoiceInfo extends Record<string, string | number> {
  /** The SSML voice gender that the voice is categorized as using, such as
   * "FEMALE".
   */
  gender: SsmlVoiceGenderNoNeutral;
  /** The BCP-47 lang-LOCALE tag that the voice supports, such as "en-US". */
  languageCode: string;
  /** The human-readable language that the voice supports in English, such as
   * "English (United States)".
   */
  languageName: string;
  /** The name of the voice, such as "en-US-Wavenet-C". */
  name: string;
  /** The pricing model of the voice, such as "Journey" */
  pricing: VoicePricingTier;
  /** The natural sampling rate preferred by the voice. Generally, this will
   * almost always be `24000` hz.
   */
  sampleRate: number;
  /** The style of speech model supported by the voice, such as "Standard",
   * "Casual", or "News".
   */
  type: VoiceStyle;
};

/** An object containing information about a language and potentially a locale.
 */
export type LocaleInfo = {
  /** A BCP-47 language and likely locale code, e.g. "en-US", or possibly "en".
   * Will never contain more than two parts (lang-LOCALE).
   */
  id: string;
  /** The English name of the entry, e.g. "English (United States)", or
   * "English".
   */
  name: string;
};

/** An object representing an array of locale information objects, as
 * serialized from `data/locales.json`.
 */
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
  /** The preferred audio sampling rate of the voice, in hertz, or samples per
   * second. Typically, 24000.
   */
  naturalSampleRateHertz: number;
};

/** An object representing an array of Google Text-to-Speech voices, as
 * serialized from `data/voices.json`, or retrieved from the Google API.
 */
export type VoicesInfo = {
  /** An array of VoiceInfo objects. */
  voices: VoiceInfo[];
};
