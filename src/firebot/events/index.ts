import {
  EventSource as fbSource,
} from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import consts from "../../consts";

import unitsBilled from "./units-billed";
import voicesChanged from "./voices-changed";

const eventSource: fbSource = {
  id: consts.EVENT_SOURCE_ID,
  name: "Google Cloud TTS",
  events: [
    unitsBilled,
    voicesChanged,
  ],
};

export default eventSource;
