import axios, { AxiosError } from "axios";

import gcp from "../..";
import { ContextLogger } from "../../../context-logger";

// Provides the text-to-speech/v1/text API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text


type SsmlInput = {
  ssml: string
};
type TextInput = {
  text: string
};
type SynthesisInput = SsmlInput | TextInput;
type CustomVoiceParams = {
  model: string;
  /** @deprecated */
  reportedUsage: string;
};
type VoiceSelectionParams = {
  customVoice?: CustomVoiceParams;
  languageCode: string;
  name?: string;
  ssmlGender?: "SSML_VOICE_GENDER_UNSPECIFIED" | "FEMALE" | "MALE";
};
type AudioEffectProfile = "handset-class-device" | "headphone-class-device" | "large-automotive-class-device" | "large-home-entertainment-class-device" | "medium-bluetooth-speaker-class-device" | "small-bluetooth-speaker-class-device" | "telephony-class-application" | "wearable-class-device";
type AudioConfig = {
  audioEncoding: "ALAW" | "LINEAR16" | "MP3" | "MULAW" | "OGG_OPUS";
  effectsProfileId?: AudioEffectProfile[];
  pitch?: number;
  sampleRateHertz?: number;
  speakingRate?: number;
  volumeGainDb?: number;
};
type TextSynthesizeResponse = {
  audioContent: string;
};

/** The Google text-to-speech v1/text API endpoint. */
export const text = {
  /**
   * Synthesize speech using the v1 text-to-speech API on the Google Cloud Platform.
   * @param input The text to be synthesized into speech.
   * @param voice The voice to use for speech synthesis.
   * @param audioConfig Information about the desired audio format and any effects to apply to it.
   * @returns A base64-encoded audio file of the specified type, or null.
   * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
   */
  async synthesize(
    input: SynthesisInput,
    voice: VoiceSelectionParams,
    audioConfig: AudioConfig,
  ): Promise<string | null> {
    const logger = new ContextLogger("gcptts.v1.text.synth");

    if (!input) {
      throw new Error("'input' parameter null or undefined");
    } else if ((input as SsmlInput) != null && (input as TextInput) != null) {
      throw new Error("'input' ssml and text parameters are mutually exclusive");
    } else if ((input as SsmlInput) == null && (input as TextInput) == null) {
      throw new Error("'input' parameter lacks input data");
    } else if ((input as SsmlInput) && !(input as SsmlInput).ssml) {
      throw new Error("input ssml parameter is null or empty");
    } else if ((input as TextInput) && !(input as TextInput).text) {
      throw new Error("input text parameter is null or empty");
    }

    if (!voice) {
      throw new Error("'voice' parameter is required but missing");
    } else if (!voice.name && !voice.languageCode) {
      throw new Error("'voice' parameter lacks both name and languageCode, at least one of which is required");
    } else if (voice.name && voice.languageCode && !voice.name.toLowerCase().startsWith(voice.languageCode.toLowerCase())) {
      logger.warn(`Voice "${voice.name}" doesn't include explicit support for the language code "${voice.languageCode}". This synthesis request will likely fail.`);
    }

    if (!audioConfig) {
      throw new Error("'audioConfig' parameter is required but missing");
    } else if (audioConfig.pitch != null && (audioConfig.pitch < -20 || audioConfig.pitch > 20)) {
      throw new Error(`pitch parameter is out of range; got ${audioConfig.pitch}, but must be between -20 and 20`);
    } else if (audioConfig.speakingRate != null && (audioConfig.speakingRate < 0.25 || audioConfig.speakingRate > 4.0)) {
      throw new Error(`speaking rate parameter is out of range; got ${audioConfig.speakingRate}, but must be between 0.25 and 4`);
    } else if (audioConfig.volumeGainDb != null && (audioConfig.volumeGainDb < -96 || audioConfig.volumeGainDb > 16)) {
      throw new Error(`volume gain parameter is out of range; got ${audioConfig.volumeGainDb}, but must be between -96 and 16`);
    }

    const integrations = gcp.connectedIntegrations;
    if (integrations.length < 1) {
      logger.warn("Auth integrations are unavailable, unable to synthesize speech");
      return null;
    }

    try {
      const response = await axios.post<TextSynthesizeResponse>(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${integrations[0].definition.accountId}`,
        {
          input,
          voice,
          audioConfig,
        },
        {
          headers: {
            "Referer": gcp.referrer,
            "User-Agent": gcp.userAgent,
          },
        });
      return response.data?.audioContent ?? null;
    } catch (err) {
      logger.errorEx(`Failed to synthesize speech (code ${(err as AxiosError).code})`, err as Error);
    }
    return null;
  },
};
