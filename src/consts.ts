/**
 * Constants available for use throughout the google-cloud-tts effect scripts.
 * Changing anything in here  is going to cause end-users a very bad time.
 */
export default Object.freeze({
  /** The version number of this plugin. */
  PLUGIN_VERSION: "0.4.0-dev",

  /** The identifier used for the apiKey authorization integration. */
  APIKEY_INTEGRATION_ID: "google-cloud-key",
  /** The new identifer use for the in-development mixed-mode (api key + OAuth) integration. */
  OAUTH2_INTEGRATION_ID: "gcptts-oauth2",

  /** The identifier used for the Google Cloud TTS effect. */
  TTS_EFFECT_ID: "phroggie:google-cloud-tts",
  /** The identifier used for the Google Cloud Update Voices effect. */
  UPDATEVOICES_EFFECT_ID: "phroggie:google-cloud-updatevoices",
});
