import { AudioEffectProfile } from "..";
import googleCloudApi from "../..";
import { SsmlVoiceGenderNoNeutral } from "../../../types";

// Provides the text-to-speech/v1beta1/text API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text

export type AudioEncoding = "ALAW"
  | "LINEAR16"
  | "MP3"
  | "MP3_64_KBPS"
  | "MULAW"
  | "OGG_OPUS";
type SsmlInput = {
  ssml: string
};
type TextInput = {
  text: string
};
type SynthesisInput = SsmlInput | TextInput;
type CustomVoice = {
  model: string;
  /** @deprecated */
  reportedUsage: string;
};
type VoiceSelection = {
  customVoice?: CustomVoice;
  languageCode: string;
  name?: string;
  ssmlGender?: SsmlVoiceGenderNoNeutral;
};
type AudioConfig = {
  audioEncoding: AudioEncoding;
  effectsProfileId?: AudioEffectProfile[];
  pitch?: number;
  sampleRateHertz?: number;
  speakingRate?: number;
  volumeGainDb?: number;
};
type RequestBody = {
  input: SynthesisInput,
  voice: VoiceSelection,
  audioConfig: AudioConfig,
};
type ResponseBody = {
  audioContent: string;
};

/** The Google text-to-speech v1beta1/text API endpoint. */
export const text = {
  /**
   * Synthesize speech using the v1beta1 text-to-speech API on the Google Cloud
   * Platform.
   * @param input The text to be synthesized into speech.
   * @param voice The voice to use for speech synthesis.
   * @param audioConfig Information about the desired audio format and any
   * effects to apply to it.
   * @param referrer An optional HTTP referrer to send along.
   * @returns A base64-encoded audio file of the specified type, or null.
   * @throws {RangeError} An audioConfig parameter exceeds allowable range.
   * @throws {Error} Parameters are malformed or an internal error occurred.
   * @throws {Error} No integrations are available to service the request.
   * @throws {GoogleCloudError} Google reported an error synthesizing the
   * speech.
   */
  async synthesize(
    input: SynthesisInput,
    voice: VoiceSelection,
    audioConfig: AudioConfig,
    referrer?: string,
  ): Promise<string | null> {
    // Try and throw up any problems before we offload it.
    if (input == null) {
      throw new Error("'input' parameter null or undefined");
    } else if ('ssml' in input && 'text' in input) {
      throw new Error("ssml and text input is mutually exclusive");
    } else if (!('ssml' in input || 'text' in input)) {
      throw new Error("'input' parameter lacks input data");
    } else if ('ssml' in input && !input.ssml) {
      throw new Error("input ssml parameter is null or empty");
    } else if ('text' in input && !input.text) {
      throw new Error("input text parameter is null or empty");
    }

    if (!voice) {
      throw new Error("'voice' parameter is required but missing");
    } else if (!voice.name && !voice.languageCode) {
      throw new Error("'voice' parameter lacks both name and languageCode, at\
 least one of which is required");
    }

    if (!audioConfig) {
      throw new Error("'audioConfig' parameter is required but missing");
    } else if (audioConfig.pitch !== undefined &&
      (audioConfig.pitch < -20 || audioConfig.pitch > 20)
    ) {
      throw new RangeError("pitch parameter exceeds allowable range");
    } else if (audioConfig.speakingRate !== undefined &&
      (audioConfig.speakingRate < 0.25 || audioConfig.speakingRate > 4.0)
    ) {
      throw new RangeError("speakingRate parameter exceeds allowable range");
    } else if (audioConfig.volumeGainDb !== undefined &&
      (audioConfig.volumeGainDb < -96 || audioConfig.volumeGainDb > 16)
    ) {
      throw new RangeError("volumeGainDb parameter exceeds allowable range");
    }

    const result = await googleCloudApi
      .fetch<ResponseBody, RequestBody>({
        method: "POST",
        service: "texttospeech",
        version: "v1beta1",
        endpoint: "text:synthesize",

        body: { input, voice, audioConfig },
        referrer: referrer,
      });
    return result?.audioContent ?? null;
  },
};
