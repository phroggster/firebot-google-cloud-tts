/**
 * Constants available for use throughout the google-cloud-tts effect scripts.
 * Changing anything in here is going to cause end-users a very bad time.
 */

export default Object.freeze({
    // Effects
    /** The identifier used for the Google Cloud TTS effect. */
    TTS_EFFECT_ID: "phroggie:google-cloud-tts",
    /** The identifier used for the Google Cloud Update Voices effect. */
    UPDATEVOICES_EFFECT_ID: "phroggie:google-cloud-updatevoices",


    // Integrations
    /** The identifier used for the apiKey authorization integration. */
    APIKEY_INTEGRATION_ID: "google-cloud-key",


    // Services
    /** The file name of the cached voice data on disk. */
    VOICENAMES_FILENAME: "voices.json",


    // Top-level
    /** The default parameters used by this plugin. */
    DEFAULT_PLUGIN_PARAMS: {
        /** The default script parameter for scriptUpdateChecks. */
        pluginUpdateCheckInterval: "OnStart",
        /** The default script parameter for voiceUpdateChecks. */
        voiceUpdateCheckInterval: "Weekly"
    },
    /** The version number of this plugin. */
    PLUGIN_VERSION: "0.4.0",
});
