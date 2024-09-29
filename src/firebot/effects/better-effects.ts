import { Effects, EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";

// Many of these type are not exported by @crowbartools/firebot-custom-scripts-types, or are
// defined using `any` instead of `unknown`, so much of that is duplicated here verbatim.
//
// Their license applies to the vast majority of this file: (GPL-3.0-only)

type EffectCategory =
  | "common"
  | "chat based"
  | "Moderation"
  | "overlay"
  | "fun"
  | "integrations"
  | "advanced"
  | "scripting";
/** The integrations that are required for the effect to be displayed, edited, and/or executed. */
type EffectDependencies = {
  /** A map of integration IDs to boolean values indicating whether those integrations are required. */
  integrations?: Record<string, boolean>;
  /** Whether or not the effect relies upon the twitch integration. */
  twitch?: boolean;
};
type Func<T> = (...args: unknown[]) => T;
type OverlayExtension<OverlayData = unknown> = {
  dependencies?: {
    globalStyles?: string;
    css?: string[];
    js?: string[];
  };
  event: {
    name: string;
    onOverlayEvent: (data: OverlayData) => void;
  };
};

// TODO: how to get this to enforce that defaultName is a string that is also a keyof TEffect...
// ...and that an array of these things cover all of the keyof TEffect as string properties?
// My Typescript-fu is lacking.

type EffectOutputDefinition = {
  defaultName: string,
  description: string,
  label: string,
};

export type BetterEffectTriggerResult<TOutputs extends Record<string, unknown> = Record<string, unknown>> = {
  execution?: {
    stop: boolean;
    bubbleStop: boolean;
  };
  outputs: TOutputs;
  success: boolean;
};

// TODO: optionsValidator probably *should* go in a PR to @crowbartools/firebot-custom-scripts-types/
// https://github.com/crowbartools/firebot-custom-scripts-types/blob/main/types/effects.d.ts

/**
 * A "better" Effects.EffectType definition with TScope and TOutputs template parameters added, and optionsValidator
 * gained a $scope.
 */
export interface BetterEffectType<
  TEffect = Record<string, unknown>,
  TScope extends EffectScope<TEffect> = EffectScope<TEffect>,
  TOutputs extends Record<string, unknown> = Record<string, unknown>,
  TOverlay = unknown,
> /* extends Effects.EffectType<TEffect, TOverlay> */ {
  definition: {
    id: string;
    name: string;
    description: string;
    icon: string;
    categories: EffectCategory[];
    // TODO: Easy PR... This is exposed as `hidden?: boolean | Func<bool>;` upstream. Note the *bool*, not a *boolean*
    hidden?: boolean | Func<boolean>;
    triggers?: Effects.TriggerType[] | Effects.TriggersObject;
    dependencies?: EffectDependencies | Array<"chat"|"overlay">;
    showWhenDependenciesNotMet?: boolean;
    outputs?: EffectOutputDefinition[];
  };
  optionsTemplate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionsController?: ($scope: EffectScope<TEffect>, ...args: any[]) => void;
  optionsValidator?: (effect: TEffect, $scope: TScope) => string[];
  onTriggerEvent: (event: {
    effect: TEffect;
    trigger: Effects.Trigger;
    sendDataToOverlay: (data: TOverlay, overlayInstance?: string) => void;
  }) => Promise<boolean | BetterEffectTriggerResult<TOutputs>>;
  overlayExtension?: OverlayExtension<TOverlay>;
};
