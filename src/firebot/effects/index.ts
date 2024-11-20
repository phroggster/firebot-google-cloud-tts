import {
  Effects,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";

import oldeSynthesizeEffect from "./olde-synthesize";
import synthesizeEffect from "./synthesize";
import updateVoicesEffect from "./update-voices";

export default [
  oldeSynthesizeEffect as Effects.EffectType<unknown, unknown>,
  synthesizeEffect as Effects.EffectType<unknown, unknown>,
  updateVoicesEffect as Effects.EffectType<unknown, unknown>,
];
