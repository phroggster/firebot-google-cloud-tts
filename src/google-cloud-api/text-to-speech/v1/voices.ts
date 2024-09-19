import axios, { AxiosError } from "axios";

import gcpapi from "../../";
import { ContextLogger } from "../../../context-logger";
import { VoiceInfo, VoicesInfo } from "../../../types";

const logger = new ContextLogger("api.v1.voices");

// Provides the text-to-speech/v1/voices API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices

export const voices = {
  /**
   * Returns a list of the voices supported for speech synthesis.
   * @param languageCode Optional, recommended; a BCP-47 formatted language and optional locale specifier to filter the request, e.g. "en" to get all English voices, "en-US" to get all English (United States) voices, etc.
   * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list
   */
  async list(languageCode?: string): Promise<VoiceInfo[]> {
    const integration = gcpapi.integrations[0];
    if (!integration || !integration.integration || !integration.integration.connected || !integration.definition || !integration.definition.accountId) {
      return null;
    }

    try {
      const langParam = languageCode && languageCode.length >= 2 ? `&languageCode=${encodeURIComponent(languageCode)}}` : "";
      const response = await axios.get<VoicesInfo>(`https://texttospeech.googleapis.com/v1/voices?key=${integration.definition.accountId}${langParam}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": gcpapi.userAgent
        }
      });
      return response.data?.voices;
    } catch (err) {
      logger.exception(`Failed to synthesize speech, code ${(err as AxiosError)?.code}`, err);
    }
    return null;
  }
};
