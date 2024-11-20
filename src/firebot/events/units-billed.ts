import { EventDefinition } from "./better-events";
import consts from "../../consts";
import { VoicePricingTier } from "../../types";

export type EventData = {
  billedUnits: number,
  pricingTier: VoicePricingTier,
};

const unitsBilledEvent: EventDefinition<EventData> = {
  id: consts.UNITS_BILLED_EVENT_ID,
  name: "TTS Units Billed",
  description: "Triggered when a Google TTS request is made, to help track\
 usage and billing.",
  manualMetadata: {
    pricingTier: "Unknown",
    billedUnits: 20,
  },
};

export default unitsBilledEvent;
