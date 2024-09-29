import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";

// This is very similar to $encodeForHtml, but is strictly limited to characters that will interfere with SSML parsing:
// https://cloud.google.com/text-to-speech/docs/ssml#reserve_characters

const model: ReplaceVariable = {
  definition: {
    handle: "encodeForSsml[text]",
    description: "Sanitizes the provided text so that it is safe for use in a Google text-to-speech effect as SSML input.",
    examples: [
      {
        usage: `encodeForSsml[Untrusted text that may not be safe to use as SSML text input (", &, ', <, >)]`,
        description: "Gets the SSML-sanitized text: `Untrusted text that may not be safe to use as SSML text input (&quot;, &amp;, &apos;, &lt;, &gt;)`",
      },
    ],
    categories: ["text"],
    possibleDataOutput: ["text"],
  },
  evaluator: (trigger: Effects.Trigger, text?: unknown): string => {
    const textStr = text == null || typeof text === "string" ? text : `${text}`;
    if (textStr == null || textStr === "") {
      return "";
    }

    return textStr
      .replace(`&`, "&amp;") // Ampersands go first, since all of the other replacements will output one
      .replace(`'`, "&apos;")
      .replace(`<`, "&lt;")
      .replace(`>`, "&gt;")
      .replace(`"`, "&quot;");
  },
};

export default model;
