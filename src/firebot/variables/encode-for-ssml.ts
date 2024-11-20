import {
  Effects,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";
import {
  ReplaceVariable,
// eslint-disable-next-line @stylistic/max-len
} from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";

// This is very similar to $encodeForHtml, but is strictly limited to
// characters that will interfere with SSML parsing:
// https://cloud.google.com/text-to-speech/docs/ssml#reserve_characters

const encodeForSsml: ReplaceVariable = {
  definition: {
    handle: "encodeForSsml[text]",
    description: "Sanitizes the provided text so that it is safe for use with\
 a Google Text-To-Speech effect as SSML input.",
    examples: [
      {
        usage: `encodeForSsml[Untrusted text or any of (", ', &, <, >)]`,
        description: "Gets the SSML-sanitized text: `Untrusted text or any of\
 (&quot;, &amp;, &apos;, &lt;, &gt;)`",
      },
    ],
    categories: ["text"],
    possibleDataOutput: ["text"],
  },
  evaluator: (trigger: Effects.Trigger, text?: unknown): string => {
    const textStr = text == null || typeof text === "string" ? text : `${text}`;
    if (!textStr) {
      return "";
    }

    return textStr
      // Ampersands go first, since all of the others will output one
      .replace(`&`, "&amp;")
      .replace(`'`, "&apos;")
      .replace(`<`, "&lt;")
      .replace(`>`, "&gt;")
      .replace(`"`, "&quot;");
  },
};

export default encodeForSsml;
