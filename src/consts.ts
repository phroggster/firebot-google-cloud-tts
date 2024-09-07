import pkgJson from "../package.json";

/** Constants available for use throughout the google-cloud-tts effect scripts. */
export const consts = Object.freeze({
    /** The identifier used for the Google Cloud TTS effect. */
    TTS_EFFECT_ID: "phroggie:google-cloud-tts",
    /** The identifier used for the Google Cloud Update Voices effect. */
    UPDATEVOICES_EFFECT_ID: "phroggie:google-cloud-updatevoices",
    /** The identifier used for the apiKey authorization integration. */
    INTEGRATION_ID: "google-cloud-key",

    /** The version number of this script. */
    SCRIPT_VERSION: pkgJson.version,
});
