import v1beta1 from "./v1beta1";
import v1 from "./v1";

/** Audio device profiles for use with GCP Text-To-Speech text/synthesize
 * requests. Supplying one or many of these will adjust the style of the audio
 * synthesis, mimicking a type of speaker that the audio is being produced from.
 */
export type AudioEffectProfile = "handset-class-device"
  | "headphone-class-device"
  | "large-automotive-class-device"
  | "large-home-entertainment-class-device"
  | "medium-bluetooth-speaker-class-device"
  | "small-bluetooth-speaker-class-device"
  | "telephony-class-application"
  | "wearable-class-device";

/** The API revisions available in the GCP Text-To-Speech service. */
export type TtsApiRevision = "v1" | "v1beta1";

export default {
  v1beta1,
  v1,
};
