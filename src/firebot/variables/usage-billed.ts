import {
  Effects,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";
import {
  ReplaceVariable,
// eslint-disable-next-line @stylistic/max-len
} from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { EventData as UnitsBilled } from "../events/units-billed";
import consts from "../../consts";
import { VoicePricingTier, voicePricingTierValueNames } from "../../types";
import { ContextLogger } from "../../context-logger";

// Data access for the phroggie:gcptts:unitsBilled event

type ResultType = number | UnitsBilled | VoicePricingTier;

const usageBilledVariable: ReplaceVariable = {
  definition: {
    handle: "gcpttsUsageBilled",
    description: "Provides cost information about a Google Cloud Platform\
 Text-To-Speech (TTS) request. Returns an object with `billedUnits` and\
 `pricingTier` properties.",
    examples: [
      {
        usage: "gcpttsUsageBilled[tier]",
        description: `Gets the pricing tier that the TTS request utilized. This\
 will be any of:\
 \`[${voicePricingTierValueNames.map(pt => `"${pt}"`).join(", ")}]\``,
      },
      {
        usage: "gcpttsUsageBilled[units]",
        description: "Gets the number of characters or bytes that were used by\
 the TTS request.",
      },
    ],
    categories: ["advanced", "trigger based"],
    possibleDataOutput: ["number", "object", "text"],
    triggers: {
      "event": [
        `${consts.EVENT_SOURCE_ID}:${consts.UNITS_BILLED_EVENT_ID}`,
      ],
      "manual": true,
    },
  },
  evaluator: (trigger: Effects.Trigger, selector?: string): ResultType => {
    // TODO: undebugging
    const logger = new ContextLogger("gcptts.vars.usage");
    logger.debug("trigger:", {
      eventData: trigger.metadata.eventData,
      metadata: trigger.metadata,
    });

    const data = (trigger?.metadata && "eventData" in trigger.metadata
      && trigger.metadata.eventData
      && "billedUnits" in trigger.metadata.eventData
      && "pricingTier" in trigger.metadata.eventData
      ? trigger.metadata.eventData
      : trigger?.metadata
        && "billedUnits" in trigger.metadata
        && "pricingTier" in trigger.metadata
        ? trigger.metadata
        : <UnitsBilled>{ billedUnits: 0, pricingTier: "Unknown"}
    ) as unknown as UnitsBilled;

    logger.debug("using data:", { data: data });

    if (selector?.toLowerCase() === "tier") {
      return data.pricingTier;
    } else if (selector?.toLowerCase() === "units") {
      return data.billedUnits;
    }
    return data;
  },
};

export default usageBilledVariable;
