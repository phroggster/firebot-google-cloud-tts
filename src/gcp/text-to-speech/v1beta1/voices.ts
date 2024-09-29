import axios, { AxiosError } from "axios";

import gcpapi from "../..";
import { ContextLogger } from "../../../context-logger";

// Provides the text-to-speech/v1beta1/voices API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/voices

type VoiceInfo = {
  languageCodes: string[];
  name: string;
  ssmlGender: "SSML_VOICE_GENDER_UNSPECIFIED" | "FEMALE" | "MALE" | "NEUTRAL";
  naturalSampleRateHertz: number;
};
type VoicesListResponse = {
  voices: VoiceInfo[];
};

/** The Google text-to-speech v1beta1/voices API endpoint. */
export const voices = {
  /**
   * Returns a list of the voices supported for speech synthesis.
   * @param languageCode Optional, recommended; a BCP-47 formatted language and optional locale specifier to filter the request, e.g. "en" to get all English voices, "en-US" to get all English (United States) voices, etc.
   * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/voices/list
   */
  async list(languageCode?: string): Promise<VoiceInfo[]> {
    const logger = new ContextLogger("gcptts.v1.voices.list");

    const integrations = gcpapi.connectedIntegrations;
    if (integrations.length === 0) {
      logger.warn("No integrations are available, unable to list voices");
      return [];
    }

    // TODO: mixed-mode integration
    try {
      const langParam = languageCode && languageCode.length >= 2 ? `&languageCode=${encodeURIComponent(languageCode)}}` : "";
      const response = await axios.get<VoicesListResponse>(`https://texttospeech.googleapis.com/v1beta1/voices?key=${integrations[0].definition.accountId}${langParam}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": gcpapi.userAgent,
        },
      });
      return response.data?.voices ?? [];
    } catch (err) {
      logger.errorEx(`Failed to list voices, code ${(err as AxiosError).code}`, err as Error);
    }
    return [];
  },
};
