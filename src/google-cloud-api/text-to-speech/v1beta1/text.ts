import axios, { AxiosError } from "axios";

import { ContextLogger } from "../../../context-logger";
import { EAudioEncoding, EAudioProfile, ESsmlVoiceGender } from "../../../types";

import gcp from "../../";

// Provides the text-to-speech/v1beta1/text API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text

/** Speech synthesis markup language (SSML) synthesis request data. */
type SsmlInput = {
  /** The speech synthesis markup language (SSML) describing the text to synthesize. */
  ssml: string
};
/** Plain text speech synthesis request data. */
type TextInput = {
  /** The plain text of the speech to synthesize. */
  text: string
};
/**
 * Text or speech synthesis markup language (SSML) input to be synthesized into speech.
 * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/SynthesisInput */
type SynthesisInput = SsmlInput | TextInput;

/** @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/CustomVoiceParams */
type CustomVoiceParams = {
  /** Required: the name of the AutoML model that synthesizes the custom voice. */
  model: string;
  /** @deprecated */
  reportedUsage: string;
};
/** @see https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/StreamingSynthesizeConfig#VoiceSelectionParams */
type VoiceSelectionParams = {
  /** Optional: the configuration for selecting a custom voice. */
  customVoice?: CustomVoiceParams;
  /** Required: The BCP-47 language and optional region code (but not a script code!) of the voice to be used. */
  languageCode: string;
  /** Optional: The name of the voice to use. */
  name?: string;
  /** Optional: The preferred gender of the voice. */
  ssmlGender?: ESsmlVoiceGender;
};

/** @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/AudioConfig */
type AudioConfig = {
  /** Required. The format of the audio byte stream. */
  audioEncoding: EAudioEncoding;
  /** Optional. */
  effectsProfileId?: EAudioProfile[];
  /** Optional. Speaking pitch, in the range of -20.0 to 20.0, with 0.0 as the native default speed. 5.0 would increase the voice pitch 5 semitones, while -5.0 would decrease the voice pitch 5 semitones. */
  pitch?: number;
  /** Optional. The sample rate of the generated audio. Leave undefined, or specify the default sampling rate of the selected voice, for the best audio quality. */
  sampleRateHertz?: number;
  /** Optional. Speaking rate or speed, in the range of 0.25 to 4.0, with 1.0 as the native default speed. 2.0 would speak twice as fast, and 0.5 would speak half as fast. */
  speakingRate?: number;
  /** Optional. The apparant amplitude to apply to the voice sample, in the range of -96.0 to 16.0, with 0.0 as the default. -6.0 would seem to be half the amplitude of the deafult, with 6.0 appearing as double the amplitude.
   * Do not provide values larger than 10.0, or the audio quality will be significantly degraded.
   */
  volumeGainDb?: number;
};

type TextSynthesizeResponse = {
  /** Base64-encoded audio data. */
  audioContent: string;
};


const logger = new ContextLogger("api.v1b1.text");

export const text = {
  /**
   * Synthesizes speech using the v1beta1 text-to-speech endpoint on the Google Cloud Platform.
   * @param input The text to be synthesized into speech.
   * @param voice The voice to use for speech synthesis.
   * @param audioConfig Information about the desired audio format and any effects to apply to it.
   * @returns A base64-encoded audio file of the specified type, or null.
   */
  async synthesize(
    input: SynthesisInput,
    voice: VoiceSelectionParams,
    audioConfig: AudioConfig,
  ): Promise<string | null> {
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

    const integrations = gcp.integrations;
    if (integrations.length < 1) {
      logger.warn("Auth integration is unavailable, unable to synthesize speech");
      return null;
    }

    try {
      const response = await axios.post<TextSynthesizeResponse>(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${integrations[0].definition.accountId}`,
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
      return response.data?.audioContent;
    } catch (err) {
      logger.exception(`Failed to synthesize speech, code ${(err as AxiosError)?.code ?? "unknown"}`, err as Error);
    }
    return null;
  },
};
