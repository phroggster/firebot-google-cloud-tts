import textToSpeech from "./text-to-speech";
import { getScriptController } from "../main";

class GoogleCloudApi {
  private _integrations: string[] = [];
  referrer: string = null;
  userAgent: string = null;

  get integrations() {
    const integrationManager = getScriptController().modules.integrationManager;
    return this._integrations
      .map(integration => integrationManager.getIntegrationById(integration))
      .filter(integration => integration.integration.connected);
  }

  get textToSpeech() {
    return textToSpeech;
  }

  addIntegration(integrationId: string) {
    if (!this._integrations.some(value => value == integrationId)) {
      this._integrations.push(integrationId);
    }
  }
}

const gcp = new GoogleCloudApi();
export default gcp;

//export namespace gcpapi.textToSpeech {
//    /** @see https://cloud.google.com/text-to-speech/docs/audio-profiles#available_audio_profiles */
//    export enum AudioProfile {
//        /** Smart watches and other wearables, like Apple Watch, Wear OS watch. */
//        wearable = "wearable-class-device",
//        /** Smartphones, like Google Pixel, Samsung Galaxy, Apple iPhone. */
//        handset = "handset-class-device",
//        /** Earbuds or headphones for audio playback, like Sennheiser headphones. */
//        headphone = "headphone-class-device",
//        /** Small home speakers, like Google Home Mini. */
//        smallbt = "small-bluetooth-speaker-class-device",
//        /** Smart home speakers, like Google Home. */
//        medbt = "medium-bluetooth-speaker-class-device",
//        /** Home entertainment systems or smart TVs, like Google Home Max, LG TV. */
//        homeent = "large-home-entertainment-class-device",
//        /** Car speakers. */
//        auto = "large-automotive-class-device",
//        /** Interactive Voice Response (IVR) systems. */
//        telephony = "telephony-class-application"
//    };

//    /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/SsmlVoiceGender */
//    export enum SsmlVoiceGender {
//        Unspecified = "SSML_VOICE_GENDER_UNSPECIFIED",
//        Male = "MALE",
//        Female = "FEMALE",
//        /** @deprecated */
//        Neutral = "NEUTRAL"
//    };

//    /**
//     * Description of a custom voice to be synthesized.
//     * @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/CustomVoiceParams
//     * */
//    export type CustomVoiceParams = {
//        /** Required: the name of the AutoML model that synthesizes the custom voice. */
//        model: string;
//        /** @deprecated */
//        // reportedUsage: string;
//    };

//    export type SsmlInput = { ssml: string };
//    export type TextInput = { text: string };

//    /**
//     * Text or speech synthesis markup language (SSML) input to be synthesized into speech.
//     * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/SynthesisInput
//     * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/SynthesisInput
//     * */
//    export type SynthesisInput = SsmlInput | TextInput;

//    /** A voice supported by the Google Cloud Platform text-to-speech API. @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list#Voice */
//    export type Voice = {
//        /**
//         * The languages that this voice supports, expressed in BCP-47 language-locale tags such as "en-US", "es-419", or "cmn-tw".
//         * Generally, this will almost always be an array containing one element: the first few characters of the voice name.
//         */
//        languageCodes: string[];
//        /** The unique name identifying the voice. */
//        name: string;
//        /** The voice's preferred audio sampling rate, usually 24000 hertz (samples per second). */
//        naturalSampleRateHertz: number;
//        /** The gender associated with the voice. */
//        ssmlGender: SsmlVoiceGender;
//    };

//    /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/StreamingSynthesizeConfig#VoiceSelectionParams */
//    export type VoiceSelectionParams = {
//        /** Optional: the configuration for selecting a custom voice. */
//        customVoice?: CustomVoiceParams;
//        /** Required: The BCP-47 language and optional region code (but not script code!) of the voice to be used. */
//        languageCode: string;
//        /** Optional: The name of the voice. */
//        name?: string;
//        /** Optional: The preferred gender of the voice. */
//        ssmlGender?: SsmlVoiceGender;
//    };

//    export namespace v1beta1 {
//        /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/AudioConfig#AudioEncoding */
//        export enum AudioEncoding {
//            /** Not specified. Will throw an INVALID_ARGUMENT error if provided. */
//            unspecified = "AUDIO_ENCODING_UNSPECIFIED",
//            /** Uncompressed 16-bit signed linear PCM audio data, packaged with a WAV file header. */
//            linear16 = "LINEAR16",
//            /** MP3-encoded (MPEG audio layer 3) audio data at 32kbps. */
//            mp3 = "MP3",
//            /** MP3-encoded (MPEG audio layer 3) audio data at 64kbps. */
//            decentmp3 = "MP3_64_KBPS",
//            /** Opus-encoded audio wrapped in an ogg container. The quality of the encoding is considerably higher than Mp3 while using approximately the same bitrate. */
//            oggopus = "OGG_OPUS",
//            /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/mu-law, packaged with a WAV file header. */
//            mulaw = "MULAW",
//            /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/A-law, packaged with a WAV file header. */
//            alaw = "ALAW"
//        };

//        /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/AudioConfig */
//        export type AudioConfig = {
//            /** Required. The format of the audio byte stream. */
//            audioEncoding: AudioEncoding;
//            /** Optional. */
//            effectsProfileId?: AudioProfile[];
//            /** Optional. Speaking pitch, in the range of -20.0 to 20.0, with 0.0 as the native default speed. 5.0 would increase the voice pitch 5 semitones, while -5.0 would decrease the voice pitch 5 semitones. */
//            pitch?: number;
//            /** Optional. The sample rate of the generated audio. Leave undefined, or specify the default sampling rate of the selected voice, for the best audio quality. */
//            sampleRateHertz?: number;
//            /** Optional. Speaking rate or speed, in the range of 0.25 to 4.0, with 1.0 as the native default speed. 2.0 would speak twice as fast, and 0.5 would speak half as fast. */
//            speakingRate?: number;
//            /** Optional. The apparant amplitude to apply to the voice sample, in the range of -96.0 to 16.0, with 0.0 as the default. -6.0 would seem to be half the amplitude of the deafult, with 6.0 appearing as double the amplitude.
//             * Do not provide values larger than 10.0, or the audio quality will be significantly degraded.
//             */
//            volumeGainDb?: number;
//        };
//    }

//    export namespace v1 {
//        /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig#AudioEncoding */
//        export enum AudioEncoding {
//            /** Not specified. Will throw an INVALID_ARGUMENT error if provided. */
//            unspecified = "AUDIO_ENCODING_UNSPECIFIED",
//            /** Uncompressed 16-bit signed linear PCM audio data, packaged with a WAV file header. */
//            linear16 = "LINEAR16",
//            /** MP3-encoded (MPEG audio layer 3) audio data at 32kbps. */
//            mp3 = "MP3",
//            /** Opus-encoded audio wrapped in an ogg container. The quality of the encoding is considerably higher than Mp3 while using approximately the same bitrate. */
//            oggopus = "OGG_OPUS",
//            /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/mu-law, packaged with a WAV file header. */
//            mulaw = "MULAW",
//            /** 8-bit samples that compand 14-bit audio samples using G.711 PCMU/A-law, packaged with a WAV file header. */
//            alaw = "ALAW"
//        };

//        /** @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig */
//        export type AudioConfig = {
//            /** Required. The format of the audio byte stream. */
//            audioEncoding: AudioEncoding;
//            /** Optional. */
//            effectsProfileId?: AudioProfile[];
//            /** Optional. Speaking pitch, in the range of -20.0 to 20.0, with 0.0 as the native default speed. 5.0 would increase the voice pitch 5 semitones, while -5.0 would decrease the voice pitch 5 semitones. */
//            pitch?: number;
//            /** Optional. The sample rate of the generated audio. Leave undefined, or specify the default sampling rate of the selected voice, for the best audio quality. */
//            sampleRateHertz?: number;
//            /** Optional. Speaking rate or speed, in the range of 0.25 to 4.0, with 1.0 as the native default speed. 2.0 would speak twice as fast, and 0.5 would speak half as fast. */
//            speakingRate?: number;
//            /** Optional. The apparant amplitude to apply to the voice sample, in the range of -96.0 to 16.0, with 0.0 as the default. -6.0 would seem to be half the amplitude of the deafult, with 6.0 appearing as double the amplitude.
//             * Do not provide values larger than 10.0, or the audio quality will be significantly degraded.
//             */
//            volumeGainDb?: number;
//        };
//    };
//};

//let _integrations: IntegrationController[] = null;
//let _referrer: string = null;
//let _userAgent: string = null;

//export default {
//    /** Get the integration controllers that the Google Cloud Platform API can utilize. */
//    getIntegrations(): IntegrationController[] {
//        return _integrations;
//    },
//    /** Get the referrer that will be sent along with API requests. Helpful for securing credentials. */
//    getReferrer(): string {
//        return _referrer;
//    },
//    /** Get the user-agent that the Google Cloud Platform API is using. */
//    getUserAgent(): string {
//        return _userAgent;
//    },

//    /** Adds the integration controller to. */
//    setIntegrations(integrations: IntegrationController[]): void {
//        _integrations = integrations;
//    },

//    /** Set the referrer that will be sent along with API requests. Helpful for securing credentials. */
//    setReferrer(referrer?: string): void {
//        _referrer = referrer;
//    },
//    /** Set the user-agent that the Google Cloud Platform API will be utilized with. */
//    setUserAgent(userAgent?: string): void {
//        _userAgent = userAgent;
//    },
//    textToSpeech
//};
