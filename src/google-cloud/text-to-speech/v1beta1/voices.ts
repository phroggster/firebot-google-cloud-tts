import googleCloudApi from "../..";
import { VoiceInfo, VoicesInfo } from "../../../types";

// Provides the text-to-speech/v1beta1/voices API endpoint.
// https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/voices

/** The Google text-to-speech v1beta1/voices API endpoint. */
export const voices = {
  /** Returns a list of the stock voices supported for speech synthesis,
   * excluding any AutoML user-trained custom voices that can only be unlocked
   * by contacting the GCP sales team and signing a contract.
   * @param languageCode Optional, recommended; a BCP-47 formatted language and
   * optional locale specifier to filter the request, e.g. "en" to get all
   * English-capable voices, "en-US" to get all English (United States)-capable
   * voices, etc.
   * @param referrer An optional HTTP referrer to send along.
   * @throws {Error} No integrations were available to service the request.
   * @throws {Error} Parameters were malformed or an internal error occurred.
   * @throws {GoogleCloudError} Google reported an error listing the voices.
   * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/voices/list
   */
  async list(
    languageCode?: string | null,
    referrer?: string | null,
  ): Promise<VoiceInfo[]> {
    const result = await googleCloudApi.fetch<VoicesInfo>({
      method: "GET",
      service: "texttospeech",
      version: "v1beta1",
      endpoint: "voices",
      ...(languageCode && { params: [`languageCode=${languageCode}`]}),
      referrer: referrer,
    });
    return result?.voices ?? [];
  },
};
