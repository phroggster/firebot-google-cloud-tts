import pkgJson from "../package.json";

/** Constants available for use throughout the google-cloud-tts-revised custom
 * plugin. Changing anything in here is going to cause end-users a bad time.
 */
export default Object.freeze({
  /** The version number of this plugin. */
  PLUGIN_VERSION: pkgJson.version,

  /** The identifier used for the apiKey authorization integration. */
  APIKEY_INTEGRATION_ID: "phroggie:gcpttsApiKey",
  /** The identifier used for the OAuth2 provider. */
  OAUTH2_AUTHPROVIDER_ID: "phroggie:gcpttsOAuth",
  /** The identifier used for the OAuth2 integration. */
  OAUTH2_INTEGRATION_ID: "phroggie:gcpttsOAuth",

  /** The identifier used by the "Check for a GCP-TTS Plugin Update" effect. */
  CHECK_UPDATE_EFFECT_ID: "phroggie:gcpttsUpdatePlugin",
  /** The original identifier used by the "OBSOLETE: Text-To-Speech
   * (Google Cloud)" effect.
   * @deprecated
   */
  OLDE_TTS_EFFECT_ID: "phroggie:google-cloud-tts",
  /** The new identifier used by the "Text-To-Speech (Google Cloud)" effect. */
  TTS_EFFECT_ID: "phroggie:gcpttsSynthesize",
  /** The identifier used by the "Update Google Cloud TTS Voices" effect. */
  UPDATEVOICES_EFFECT_ID: "phroggie:gcpttsUpdateVoices",

  /** The name for the group of events that are owned by this plugin. */
  EVENT_SOURCE_ID: "phroggie-gcptts",
  /** An event that fires when a TTS request is made, to aid with tracking
   * billing.
   */
  UNITS_BILLED_EVENT_ID: "unitsBilled",
  /** An event that fires when TTS voices are added or removed. */
  VOICES_CHANGED_EVENT_ID: "voicesChanged",

  /** Various communicator signals. */
  signals: {
    /** Gets a boolean value indicating if an integration is configured. */
    isIntegrationConfigured: "gcpttsIsIntegrationConfigured",
    /** Gets a boolean value indicating if an integration is connected. */
    isIntegrationConnected: "gcpttsIsIntegrationConnected",
  },
});
