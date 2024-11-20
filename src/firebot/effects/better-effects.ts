import {
  Effects as FbEffects,
  EffectScope as FbScope,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";

// Many of these type are used in Firebot, but are not exported or exposed by
// @crowbartools/firebot-custom-scripts-types, or are defined using `any`
// instead of `unknown`. As such, much of that code is duplicated here
// nearly-verbatim to support some more-advanced use cases.
//
// I've also worked hard to jsdoc all of the stuff in here to make it easier
// to use. With that said:
//
// The Firebot license applies to this entire file: GPL-3.0

/** A function that accepts any arguments and returns the specified type. */
type Func<T> = (...args: unknown[]) => T;

/** The various categories that an effect can be listed under. */
type EffectCategory =
  | "advanced"
  | "chat based"
  | "common"
  | "fun"
  | "integrations"
  | "Moderation"
  | "overlay"
  | "scripting";

/** Identifiers of the available trigger types. */
// TODO: PR: several of these are missing from upstreams
// at least: channel_reward, scheduled_task, timer
type TriggerType =
  | "api"
  | "channel_reward"
  | "command"
  | "counter"
  | "custom_script"
  | "event"
  | "hotkey"
  | "preset"
  | "quick_action"
  | "scheduled_task"
  | "startup_script"
  | "timer"
  | "manual";

/** The dependencies that are required for an effect to be executed. */
type EffectDependencies = {
  /** A map of integration IDs to boolean values indicating whether those
   * integrations are *ALL* required in order to execute the effect.
   */
  integrations?: Record<string, boolean>;
  /** Whether or not the effect relies upon the Twitch integration. */
  twitch?: boolean;
};

type BaseCommandData = Record<string, unknown> & {
  chatMessage?: unknown, // TODO:
  command: {
    active: boolean,
    autoDeleteTrigger?: boolean,
    cooldown: {
      global?: number,
      user?: number,
    },
    cooldownMessage?: string,
    description?: string,
    effects?: FbEffects.EffectList,
    id: string,
    restrictionData: {
      failMessage: string,
      mode: string, // TODO: "any" | "all" ?
      restrictions: unknown[], // TODO:
      sendFailMessage: boolean,
      useCustomFailMessage?: boolean, // system commands only?
    },
    scanWholeMessage?: boolean,
    sendCooldownMessage?: boolean,
    treatQuotedTextAsSingleArg: boolean,
    trigger: string, // The main trigger for the command
    type: string, // "custom"
  },
  userCommand?: {
    args: unknown[], // TODO:
    commandSender: string,
    senderRoles: string[],
    trigger: string, // The actual trigger or alias that was matched
  },
  username: string | null,
  userDisplayName?: string | null,
  userId?: string | null,
}
type SystemCommandData<TOptions> = BaseCommandData & {
  command: {
    name: string;
    options?: TOptions;
  };
};
type UserCommandData = BaseCommandData & {
  command: {
    aliases?: string[],
    count?: number,
    createdAt?: Date,
    createdBy?: string,
    hidden?: boolean,
    lastEditAt?: Date,
    lastEditBy?: string,
    simple?: boolean,
    sortTags?: string[],
  },
};
export type Trigger<TData = unknown> = (
{
  type: "custom_script" | "startup_script" | "manual";
  metadata: Record<string, unknown> & {
    username: string | null;
    userDisplayName?: string | null;
    userId?: string | null;
  };
} | {
  type: "api";
  metadata: Record<string, unknown> & {
    username: string | null,
    userDisplayName?: string | null,
    userId?: string | null,
  } & TData;
} | {
  type: "channel_reward";
  // channel-rewards.d.ts RewardRedemptionMetadata
  metadata: Record<string, unknown> & {
    username: string;
    userId: string;
    userDisplayName: string;
    messageText: string;
    redemptionId: string;
    rewardCost: number;
    rewardId: string;
    rewardImage: string;
    rewardName: string;
  };
} | {
  type: "command";
  // command-runner.ts execute()
  metadata: SystemCommandData<TData> | UserCommandData;
} | {
  type: "counter";
  // counter-manager.ts _runEffects()
  metadata: Record<string, unknown> & {
    username: string | null;
    counter: {
      id?: string;
      minimum?: number;
      maximum?: number;
      name: string;
      previousValue: number;
      value: number;
    };
  };
} | {
  type: "event";
  // events-router.js runEventEffects()
  metadata: Record<string, unknown> & {
    username?: string | null;
    userId?: string | null;
    event: {
      id: string;
      name: string;
    };
    eventData?: TData;
    eventSource: {
      id: string;
      name: string;
    };
  };
} | {
  type: "hotkey";
  // hotkey-manager.js runHotkey()
  metadata: {
    username: string | null;
    hotkey: {
      active: boolean;
      code: string;
    };
  };
} | {
  type: "quick_action" | "preset";
  // effectsApiController.js runPresetEffectList()
  metadata: {
    username: string | null;
    // TODO: I hunch that this is likely Record<string, unknown>
    presetListArgs?: unknown;
  };
} | {
  type: "scheduled_task";
  // timers.d.ts ScheduledTask
  metadata: Record<string, unknown> & {
    task: {
      id: string;
      effects: FbEffects.EffectList;
      enabled: boolean;
      inputType?: string;
      /** The name of the Scheduled Task. */
      name: string;
      onlyWhenLive?: boolean;
      schedule: string;
      sortTags?: string[];
    };
  };
} | {
  type: "timer";
  // timers.d.ts Timer
  metadata: Record<string, unknown> & {
    username: string | null;
    userId?: string | null;
    userDisplayName?: string | null;
    timer: {
      active?: boolean;
      effects?: FbEffects.EffectList;
      id?: string;
      interval?: number;
      name?: string;
      onlyWhenLive?: boolean;
      requiredChatLines?: boolean;
      sortTags?: unknown[];
    };
  };
});

/** Defines the triggers that are allowed to utilize the effect. */
type AllowedTriggers = {
  [T in TriggerType]?: T extends "event" ? string[] | boolean : boolean;
};

/** The data required for an effect to interact with the overlay. */
type OverlayExtension<TOverlayData = unknown> = {
  dependencies?: {
    globalStyles?: string;
    css?: string[];
    js?: string[];
  };
  event: {
    name: string;
    onOverlayEvent: (data: TOverlayData) => void;
  };
};

/** A base class representing the output data type of an effect execution. */
export type EffectOutputs = Record<string, unknown>;
/** The returned results of an effect execution. */
export type EffectTriggerResponse<
  TOutputs extends Record<string, unknown> = EffectOutputs
> = {
  /** Control how the effects list should continue. */
  execution?: {
    /** When `true`, **one** parent effects list should stop. */
    stop: boolean;
    /** When `true`, **all** parent effects lists should stop. */
    bubbleStop: boolean;
  };
  /** The return result from the effect execution. */
  outputs: TOutputs;
  /** When `true`, the effect succeeded; otherwise, `false` */
  success: boolean;
};

// TODO: how to get this to enforce that defaultName is a string that is also a
// `keyof TEffect` and that an array of these things covers all of the
// `Extract<keyof TEffect, string>` properties? My Typescript-fu is lacking.
//
// type EffectOutputDef<
//   TOutput extends EffectOutputs = EffectOutputs
// > = {
//   defaultName: keyof TOutput;
//   description: string;
//   label: string;
// }
// type SomeDefinitionB<
//   TOutput extends Record<string, unknown>> = Array<EffectOutputDef<TOutput>>
// > {
// }

/** A definition of the effect's output type. */
type EffectOutputDefinition<
  TOutputs extends EffectOutputs = EffectOutputs
> = {
  /** The default name of the output's property. */
  defaultName: keyof TOutputs,
  /** A description of the outputs property. */
  description: string,
  /** Text describing the purpose and/or usage of an effect's output. */
  label: string,
};

// TODO: optionsValidator probably *should* go in a PR to @crowbartools/fbcst
// https://github.com/crowbartools/firebot-custom-scripts-types/blob/main/types/effects.d.ts

/** A "better" `Effects.EffectType` definition with TScope and TOutputs
 * template parameters, and optionsValidator gains the $scope arg.
 */
export interface EffectType<
  TEffect extends Record<string, unknown> = Record<string, unknown>,
  TScope extends FbScope<TEffect> = FbScope<TEffect>,
  TOutputs extends Record<string, unknown> = Record<string, unknown>,
  TOverlay = unknown,
> /* extends FbEffects.EffectType<TEffect, TOverlay> */ {
  definition: {
    id: string;
    name: string;
    description: string;
    icon: string;
    categories: EffectCategory[];
    dependencies?: EffectDependencies | Array<"chat">;
    // TODO: Easy PR... This is exposed as `hidden?: boolean | Func<bool>;`
    // upstream. Note `bool`, not `boolean`
    hidden?: boolean | Func<boolean>;
    outputs?: EffectOutputDefinition<TOutputs>[];
    showWhenDependenciesNotMet?: boolean;
    triggers?: AllowedTriggers | TriggerType[];
  };
  optionsTemplate: string;
  optionsController?: (
    $scope: TScope,
    ...args: unknown[]
  ) => void;
  optionsValidator?: (
    effect: TEffect,
    $scope: TScope,
  ) => string[];
  onTriggerEvent: (event: {
    effect: TEffect;
    trigger: Trigger;
    sendDataToOverlay: (
      data: TOverlay,
      overlayInstance?: string,
    ) => void;
  }) => Promise<boolean | EffectTriggerResponse<TOutputs>>;
  overlayExtension?: OverlayExtension<TOverlay>;
};

type EffectRunnerOutput<TOutputs extends EffectOutputs = EffectOutputs> = {
  success: boolean;
  stopEffectExecution: boolean;
  outputs: TOutputs;
} | null;

export type ProcessEffectsRequest = {
  trigger: Trigger;
  effects: FbEffects.EffectList;
};

export type EffectRunner = {
  processEffects: <TOutputs extends EffectOutputs = EffectOutputs>(
    processEffectsRequest: ProcessEffectsRequest
  ) => Promise<EffectRunnerOutput<TOutputs>>;
};
