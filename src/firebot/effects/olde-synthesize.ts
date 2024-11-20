import {
  Effects,
  EffectScope,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";

import {
  EffectType,
  ProcessEffectsRequest,
} from "./better-effects";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";

// TODO: This effect *will* be removed in the future.
//
// This is an effect to support viewing *BUT NOT EXECUTING* v0.3.0 and older
// TTS effects, which used a different effect ID.

interface EffectData extends Record<string, unknown> {
  /** The audio output device to speak the text out with: e.g. "App Default",
   * "overlay", "Headphones", "Speakers", etc.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audioOutputDevice?: any;
  /** The pitch adjustment to use. Default: 0.0. */
  effectPitch?: number;
  /** The audio device profile effects to use for the text-to-speech
   * generator.
   */
  effectProfiles?: Array<string>;
  /** The speaking rate to use. Default: 1.0. */
  effectRate?: number;
  /** Adjust the apparent amplitude gain of the voice. Default: 0.0. */
  effectVolume?: number;
  /** The BCP-47 language and locale code to use. */
  language: string;
  /** The volume to play the resulting sample at.
   * Default 5.0, range 1.0 to 10.0.
   */
  outputVolume?: number;
  /** Used to specify which overlay instance to send audio to when overlay
   * instancing has been enabled.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overlayInstance?: any;
  /** The input text to synthesize. */
  text: string;
  /** The name of the voice for Google TTS to utilize. */
  voice: string;
};

interface Scope extends EffectScope<EffectData> {
  defaultSettings: EffectData;
};

const oldeSynthesizeEffect: EffectType<EffectData, Scope> = {
  definition: {
    id: consts.OLDE_TTS_EFFECT_ID,
    name: "OBSOLETE: Text-To-Speech (Google Cloud)",
    categories: ["fun", "integrations"],
    description: "This effect has been removed and no longer functions. Please\
 migrate this effect's settings over to a new effect, and delete this one as\
 soon as possible.",
    hidden: true,
    icon: "fad fa-microphone-alt",
  },
  optionsTemplate:
    `
      <eos-container header="Warning">
        <div class="effect-info alert alert-danger">
          <strong>
            This effect is obsolete and <i>will</i> be removed in the future.
          </strong><br><br>
          Please <i>manually</i> migrate the information shown below to a new
          "<strong>Text-To-Speech (Google Cloud)</strong>" effect to continue
          using it.
        </div>
      </eos-container>

      <eos-container header="Input Text" pad-top="true">
        <textarea
          readonly
          ng-model="effect.text"
          class="form-control"
          rows="4" cols="40"
        ></textarea>
      </eos-container>

      <eos-container header="Voice Selection" pad-top="true">
        <textarea
          readonly
          ng-model="effect.voice"
          class="form-control"
          rows="1" cols="40"
        ></textarea>
      </eos-container>

      <eos-container header="Audio Effects" pad-top="true">
        <div>
          <h5>Amplitude Adjust</h5>
          <textarea
            readonly
            ng-model="effect.effectVolume"
            class="form-control"
            rows="1" cols="40"
          ></textarea>
        </div>
        <div class="mt-5">
          <h5>Pitch Adjust</h5>
          <textarea
            readonly
            ng-model="effect.effectPitch"
            class="form-control"
            rows="1" cols="40"
          ></textarea>
        </div>
        <div class="mt-5">
          <h5>Speaking Rate</h5>
          <textarea
            readonly
            ng-model="effect.effectRate"
            class="form-control"
            rows="1" cols="40"
          ></textarea>
        </div>
      </eos-container>

      <eos-container header="Output Settings" pad-top="true">
        <div>
          <h5>Output Device</h5>
          <textarea readonly
            ng-if="!effect.audioOutputDevice ||\
 effect.audioOutputDevice.label === 'App Default'"
            class="form-control" rows="1" cols="40"
          >App Default</textarea>
          <textarea readonly
            ng-if="effect.audioOutputDevice &&\
 effect.audioOutputDevice.deviceId === 'overlay'"
            class="form-control" rows="1" cols="40"
          >Overlay</textarea>
          <textarea
            readonly ng-if="effect.audioOutputDevice &&\
 effect.audioOutputDevice.label &&\
 effect.audioOutputDevice.label !== 'App Default' &&\
 effect.audioOutputDevice.deviceId !== 'overlay'"
            class="form-control" rows="1" cols="40"
          >{{effect.audioOutputDevice.label}}</textarea>
        </div>
        <div class="mt-5" ng-if="effect.audioOutputDevice &&\
 effect.audioOutputDevice.deviceId === 'overlay' &&\
 effect.overlayInstance"
        >
          <h5>Overlay Instance</h5>
          <textarea
            readonly class="form-control"
            rows="1" cols="40"
          >{{effect.overlayInstance}}</textarea>
        </div>
      </eos-container>
    `,
  optionsController: ($scope: Scope) => {
    $scope.defaultSettings = Object.freeze<EffectData>({
      text: "",
      language: "en-US",
      voice: "en-US-Standard-C",
      effectProfiles: [],
      effectPitch: 0.0,
      effectRate: 1.0,
      effectVolume: 0.0,
      audioOutputDevice: null,
      outputVolume: 10.0,
    });

    $scope.effect ??= $scope.defaultSettings;
    $scope.effect.effectVolume ??= $scope.defaultSettings.effectVolume;
    $scope.effect.audioOutputDevice
      ??= $scope.defaultSettings.audioOutputDevice;
    $scope.effect.effectProfiles ??= $scope.defaultSettings.effectProfiles;
    $scope.effect.language ??= $scope.defaultSettings.language;
    $scope.effect.outputVolume ??= $scope.defaultSettings.outputVolume;
    $scope.effect.effectPitch ??= $scope.defaultSettings.effectPitch;
    $scope.effect.effectRate ??= $scope.defaultSettings.effectRate;
    $scope.effect.text ??= $scope.defaultSettings.text;
    $scope.effect.voice ??= $scope.defaultSettings.voice;
  },
  optionsValidator: () => {
    return [];
  },
  onTriggerEvent: async (event) => {
    const logger = new ContextLogger("gcptts.effect.oldeSynthesize");
    const { effectRunner, settingsProvider } = customPlugin;
    const { effect, trigger } = event;

    // TODO: undebugging
    logger.warn("the event was:", {
      effect: effect,
      trigger: trigger,
    });

    let origin: string;
    if (trigger?.type === "command"
      && trigger.metadata?.command?.trigger
    ) {
      origin = `the "${trigger.metadata.command.trigger}" command`;
    } else if (trigger?.type === "event"
      && trigger.metadata?.event?.name
      && trigger.metadata.eventSource?.name
    ) {
      origin = `the "${trigger.metadata.event.name}\
 (${trigger.metadata.eventSource.name})" event`;
    } else if (trigger?.type === "timer"
      && trigger.metadata?.timer?.name
    ) {
      origin = `the "${trigger.metadata.timer.name}" timer`;
    } else if (trigger?.type === "hotkey"
      && trigger.metadata?.hotkey?.code
    ) {
      origin = `the ${trigger.metadata.hotkey.code} hotkey`;
    } else if (trigger?.type === "counter" && trigger.metadata?.counter.name) {
      origin = `the ${trigger.metadata.counter.name} counter`;
    } else if (trigger?.type === "preset") {
      // We don't seem to have a way to get the name of a preset effects list...
      origin = "a preset effects list";
    } else if (trigger?.type === "quick_action") {
      // We don't seem to have a way to get the name of a quick action button?
      origin = "a quick action button";
    } else if (trigger?.type === "manual") {
      origin = "a manual effects list test";
    } else {
      // not-reachable?
      origin = `a "${trigger.type}" source`;
    }

    if (!settingsProvider.flagObsolete(origin)) {
      return true;
    }
    const sharedMessage = `An outdated Google Text-To-Speech (Revised) effect\
 was triggered by ${origin}. Please re-create this effect as soon as possible\
 to take advantage of the updated Google TTS effect.`;

    logger.error(`${sharedMessage} The text to be synthesized was:\
 "${event.effect.text}"`);

    const alertRequest: ProcessEffectsRequest = {
      trigger: trigger,
      effects: <Effects.EffectList> {
        list: <Effects.Effect<unknown>[]>[
          {
            active: true,
            message: sharedMessage,
            type: "firebot:chat-feed-alert",
          },
        ],
      },
    };
    await effectRunner.processEffects(alertRequest);
    return true;
  },
};

/** @deprecated */
export default oldeSynthesizeEffect;
