import { EventDefinition } from "./better-events";
import consts from "../../consts";

export type EventData = {
  voicesAdded: string[],
  voicesRemoved: string[],
};

const voicesChangedEvent: EventDefinition<EventData> = {
  id: consts.UNITS_BILLED_EVENT_ID,
  name: "TTS Voices Changed",
  description: "Triggered when Google TTS voices are added or removed.",
  manualMetadata: {
    voicesAdded: ["en-US-Standard-TestVoiceA"],
    voicesRemoved: ["en-US-Standard-TestVoiceB"],
  },
};

export default voicesChangedEvent;
