import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";

import synthesizeEffect from "./synthesize";
import updateVoicesEffect from "./update-voices";

export default [
  synthesizeEffect as Effects.EffectType<unknown, unknown>,
  updateVoicesEffect as Effects.EffectType<unknown, unknown>,
];
