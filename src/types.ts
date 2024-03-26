/** Options for a Google Cloud Text-To-Speech Firebot effect instance. */
export interface GoogleTtsEffectModel {
    /** The text to be spoken aloud. (input: text) */
    text: string;

    /** The BCP-47 language and locale code to use.
     * (google.tts.VoiceSelectionParams: languageCode) */
    language: string;
    /** The name of the voice for Google TTS to utilize.
     * (google.tts.VoiceSelectionParams: name) */
    voice: string;
    ///** The SsmlVoiceGender of the selected voice: MALE, FEMALE, or SSML_VOICE_GENDER_UNSPECIFIED.
    // * (google.tts.VoiceSelectionParams: ssmlGender) */
    //gender?: string;

    /** The audio device profile effect to use for the text-to-speech generator.
     * (google.tts.AudioConfig: effectsProfileId[])
     * @see https://cloud.google.com/text-to-speech/docs/audio-profiles
     */
    effectProfiles?: Array<string>;
    /** The pitch tuning modifier to use for the text-to-speech generator. Default 0.0, range -20 to 20.
     * (google.tts.AudioConfig: pitch) */
    effectPitch?: number;
    /** The speaking rate tuning modifier to use for the text-to-speech generator. Default 1.0, range 0.25 to 4.0.
     * (google.tts.AudioConfig: speakingRate) */
    effectRate?: number;
    /** The volume modifier to use for the text-to-speech sample generator. Default 0.0, range -96 to 16 (but don't go above 4).
     * (google.tts.AudioConfig: volumeGainDb) */
    effectVolume?: number;

    /** The audio output device to speak the text out with: e.g. "App Default", "overlay", "Headphones", "Speakers", etc. */
    audioOutputDevice?: any;
    /** Used to specify which overlay to pipe audio through when multiple overlays are in use. */
    overlayInstance?: any;
    /** The volume to play the resulting sample at. Default 5.0, range 1.0 to 10.0. */
    outputVolume?: number;
}

/** An object representing audio effects applicable to a speech synthesis request. */
export type EffectParams = {
    /** Optional; device profile identifiers to simulate various audio effects.
     * @see GoogleTtsEffectModel.effectProfiles
     */
    effects?: Array<string>;
    /** Optional; the pitch tuning modifier to use for the text-to-speech synthesis. Default 0.0, range -20 to 20.
     * @see GoogleTtsEffectModel.effectPitch
     */
    pitch?: number;
    /** Optional; the rate tuning modifier to use for the text-to-speech synthesis. Default 1.0, range 0.25 to 4.0.
     * @see GoogleTtsEffectModel.effectRate
     */
    rate?: number;
    /** Optional; the volume modifier in deciBels (dB) to apply to the speech synthesis. Default 0.0, range -96 to 16 (but don't go above 4).
     * @see GoogleTtsEffectModel.effectVolume
     */
    volume?: number;
};

/** An object representing information about a Google Text-to-Speech voice. */
export type VoiceInfo = {
    /** The gender associated with the voice. */
    gender: string;
    /** The human-readable language and locale that the voice utilizes. */
    language: string;
    /** The unique name identifying the voice. */
    name: string;
};

/** An object representing which voice to use for speech synthesis. */
export type VoiceSelectionParams = {
    /** The BCP-47 language code of the voice.
     * @see GoogleTtsEffectModel.language
     */
    language: string;
    /** The voice name to use for speech synthesis.
     * @see GoogleTtsEffectModel.voice
     */
    name: string;
}

/** Services and APIs available from the Google Cloud Platform. */
export type GoogleCloud = {
    /**
     * Obtain a list of VoiceInfo elements that can be utilized by the speech synthesis API.
     * @param languageCode Optional; a BCP-47 language code to search for. If not provided, all voices will be returned.
     * @returns A list of VoiceInfo elements that can be used for TTS synthesis.
     */
    listVoices: (
        languageCode?: string,
    ) => Promise<Array<VoiceInfo> | undefined>;
    /**
     * Synthesizes speech using an SSML string as input.
     * @param ssmlToSynthesize The Speech Synthesis Markup Language (SSML) to synthesize into speech from.
     * @param voiceParams The voice to use for synthesis.
     * @param effectParams Optional; allows for some audio effects to be applied to the synthesis.
     * @returns A base64-encoded string containing an MP3 file of the audio data.
     */
    synthesizeSsml: (
        ssmlToSynthesize: string,
        voiceParams: VoiceSelectionParams,
        effectParams?: EffectParams,
    ) => Promise<string | undefined>;
    /**
     * Synthesizes speech using a text string as input.
     * @param textToSynthesize The text to be synthesized into speech.
     * @param voiceParams The voice to use for synthesis.
     * @param effectParams Optional; allows for some audio effects to be applied to the synthesis.
     * @returns A base64-encoded string containing an MP3 file of the audio data.
     */
    synthesizeText: (
        textToSynthesize: string,
        voiceParams: VoiceSelectionParams,
        effectParams?: EffectParams,
    ) => Promise<string | undefined>;
    /**
     * Determine if the provided values are valid audio effects for speech synthesis.
     * @param audioEffects A string array containing a list of audio effects.
     * @returns true if the provided values are null, empty, or are all valid effects; false otherwise.
     */
    validateEffects: (
        audioEffects?: Array<string>
    ) => boolean | PromiseLike<boolean>;
};
