import { EffectScope } from
  "@crowbartools/firebot-custom-scripts-types/types/effects";
import { v4 as uuid } from "uuid";
import fs from "fs";
import fsp from "fs/promises";

import googleCloudApi from "../../google-cloud";
import {
  AudioEffectProfile,
  TtsApiRevision,
} from "../../google-cloud/text-to-speech";
import { AudioEncoding as V1B1AudioEncoding } from
  "../../google-cloud/text-to-speech/v1beta1/text";

import {
  EffectOutputs,
  EffectTriggerResponse,
  EffectType,
} from "./better-effects";
import { EventData as UnitsBilled } from "../events/units-billed";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";
import {
  ExtendedVoiceInfo,
  VoicePricingTier,
} from "../../types";
import { wait } from "../../utils";

interface EffectData extends Record<string, unknown> {
  /** Adjust the apparent amplitude of the voice. Default: `0.0`, range `-96`
   * to `16`.
   */
  amplitudeAdjust?: number;
  /** The text-to-speech API revision to use. Default: v1. Acceptable values:
   * v1, v1beta1.
   */
  apiVersion: TtsApiRevision;
  /** The audio format specifier to use. Default: `oggopus` */
  audioFormat: V1B1AudioEncoding;
  /** The audio output device to speak the text out with: e.g. "App Default",
   * "overlay", "Headphones", "Speakers", etc.
   */
  audioOutputDevice: {
    deviceId?: string;
    label?: string;
  };
  /** An array of available speech synthesis effect profiles used to simulate
   * listening on various audio devices. Default: [].
   */
  effectProfiles: AudioEffectProfile[];
  /** The volume to play the resulting sample at. Default `5.0`, range `1.0` to
   * `10.0`.
   */
  outputVolume: number;
  /** The pitch adjustment to use. Default `0.0`, range `-20` to `20`. */
  pitchAdjust?: number;
  /** The speaking rate to use. Default `1.0`, range `0.25` to `4`. */
  speakingRate?: number;
  /** Is SSML parsing enabled in the input text. Default: `false`. */
  ssml: boolean;
  /** How to treat errors, default `false`. true or "true" will stop, "bubble"
   * will both stop and bubble stop.
   */
  stopOnError: "false" | "stop" | "bubble" | "bubbleStop";
  /** The input text or SSML to synthesize. */
  text: string;
  /** Whether variables are enabled for voiceName. Default: `false`. When
   * `true`, language will be undefined until the effect is actually run.
   */
  variableVoice: boolean;
  /** The name of the voice to use to synthesize the speech. */
  voiceName: string;
  /** Whether or not to wait for playback to finish before marking the effect
   * as completed. Default: `true`.
   */
  waitForPlayback: boolean;

  /** The voice to fallback to if variableVoice is set, but voiceName doesn't
   * resolve to a legit voice.
   */
  fallbackVoiceName?: string;
  /** The BCP-47 language and optional region code to use. When nullish, the
   * language will be inferred from voiceName.
   */
  language?: string;
  /** Used to specify which overlay instance to send audio to when overlay
   * instancing has been enabled.
   */
  overlayInstance?: string;
};
interface Outputs extends EffectOutputs {
  ttsUsage: {
    /** The number of characters or bytes billed out. */
    billedUnits: number,
    /** The pricing tier that was billed out, or `null` if nothing was
     * billed.
     */
    pricingTier: VoicePricingTier | null,
    /** The primary voice name used to synthesize speech, excluding any SSML
     * voice changes.
     */
    voiceName: string | null,
    /** The class of voice that was used to synthesize speech, excluding any
     * SSML voice changes.
     */
    voiceType: string | null,
  },
};
interface TriggerResponse extends EffectTriggerResponse<Outputs>{};
interface Scope extends EffectScope<EffectData> {
  // "read-only" properties

  /** The default settings for this effect. Do not change. */
  defaultSettings: EffectData;
  /** A list of the API revisions available for use and their corresponding
   * human-readable names. Do not change.
   */
  apiVersions: { id: TtsApiRevision, name: string }[];
  /** A list of the audio file formats available for use. Do not change. */
  audioFormats: { id: string, name: string, tooltip: string }[];
  /** A list of the audio effects available for use. Do not change. */
  deviceProfiles: { id: string, icon: string, name: string, tooltip: string }[];
  /** A list of the voice genders available. Do not change. */
  genders: { id: string, name: string }[];
  /** A list of the voices available to choose from. Do not change. */
  voices: ExtendedVoiceInfo[];

  // "read-write" intermediary properties

  /** Whether the fallbackVoiceName input should be shown. */
  fallbackVoiceEnabled: boolean;
  /** A boolean value indicating whether an integration is configured. */
  isIntegrationConfigured: boolean;
  /** Whether a bubble stop request will be emitted after an error. Helper
   * cache for effect.stopOnError.
   */
  wantsBubbleStop: boolean;
  /** Whether a stop request will be emitted after an error. Helper cache for
   * effect.stopOnError.
   */
  wantsStop: boolean;

  // functions

  /** Get a boolean value indicating whether the provided voice name uses a
   * Journey voice model, which lacks SSML support, rate and pitch adjustment,
   * and A-Law encoding.
   * @param voiceName The name of the voice to check.
   * @returns `true` if the voice uses a Journey model, `false` otherwise.
   * @see https://cloud.google.com/text-to-speech/docs/voice-types#journey_voices
   */
  isJourneyVoice: (voiceName: string) => boolean;
  /** Get a boolean value indicating whether the provided voice name uses a
   * Studio voice model, which lacks some SSML support.
   * @param voiceName The name of the voice to check.
   * @returns `true` if the voice uses a Studio model, `false` otherwise.
   * @see https://cloud.google.com/text-to-speech/docs/voice-types#studio_voices
   */
  isStudioVoice: (voiceName: string) => boolean;
  /** Get a boolean value indicating whether any synthesis effects are
   * different than their default values.
   */
  areAnyEffectsCustomized: () => boolean;
  /** Get the human-readable name of the given API identifier. */
  getApiName: (apiId: string) => string;
  /** Get the human-readable description of an audio profile effect. */
  getEffectDescription: (deviceProfileId: string) => string;
  /** Get the icon string for an audio profile effect. */
  getEffectIcon: (deviceProfileId: string) => string;
  /** Get the human-readable name of an audio profile effect. */
  getEffectName: (deviceProfileId: string) => string;
  /** Get the tooltip text for the given audio format. */
  getFormatTooltip: (fmtId: string) => string;
  /** Get the human-readable name of an audio format. */
  getFormatName: (fmtId: string) => string;
  /** Get the human-readable name of a gender. */
  getGenderName: (genderId: string) => string;
  /** Open the given URI in an external web browser. */
  openLink: (uri: string) => void;
  /** Reset all audio effects to their default values. */
  resetAudioEffects: () => void;

  /** Change the bubble stop-on-error value. */
  bubbleChanged: (newValue: boolean) => void;
  /** Change the stop-on-error value. */
  stopChanged: (newValue: boolean) => void;
};
interface OverlayData {
  audioOutputDevice: {
    deviceId?: string;
    label?: string;
  };
  filepath: string;
  format: string;
  maxSoundLength: number;
  volume: number;

  overlayInstance?: string;
  resourceToken?: string;
};

// v1beta1 allows MP3_64_KBPS, while v1 does not, so use the v1b1 type here.
const audioFileExts = Object.freeze<{ id: V1B1AudioEncoding, ext: string }[]>([
  { id: "ALAW", ext: "wav" },
  { id: "LINEAR16", ext: "wav" },
  { id: "MP3", ext: "mp3" },
  { id: "MP3_64_KBPS", ext: "mp3" },
  { id: "MULAW", ext: "wav" },
  { id: "OGG_OPUS", ext: "ogg" },
]);

const synthesizeEffect: EffectType<
  EffectData, Scope, Outputs, OverlayData
> = {
  definition: {
    id: consts.TTS_EFFECT_ID,
    name: "Text-To-Speech (Google Cloud)",
    categories: ["fun", "integrations"],
    description: "Have Firebot read out some text using the Google Cloud\
 Revised TTS plugin.",
    hidden: false,
    icon: "fad fa-microphone-alt",
    outputs: [
      {
        label: "TTS Usage",
        description: "An object containing information about the TTS request\
 including properties: `billedUnits` (number), `pricingBucket` (string),\
 `voiceName` (string), and `voiceType` (string).",
        defaultName: "ttsUsage",
      },
    ],
  },
  optionsTemplate:
    `
      <eos-container
        header="Configuration Required" ng-show="!isIntegrationConfigured"
      >
        <div class="effect-info alert alert-warning">
          This effect requires a Google Cloud Platform integration to be
          configured before it can execute. Visit <strong>Settings</strong>
          &gt; <strong>Integrations</strong> to configure one.
        </div>
      </eos-container>

      <eos-container header="Input Text" pad-top="!isIntegrationConfigured">
        <div ng-show="effect.ssml === true" class="mt-2">
          <span><p>The SSML-formatted text to synthesize into speech:</p></span>
          <textarea ng-model="effect.text" class="form-control mb-5" type="text"
            placeholder="Enter the SSML-formatted text to synthesize into\
 speech, including the required enclosing &lt;speak&gt; and &lt;/speak&gt;\
 tags…"
            replace-variables menu-position="under"
            rows="4" cols="40"
          ></textarea>
        </div>
        <div ng-show="effect.ssml !== true" class="mt-2">
          <span><p>The plain text to synthesize into speech:</p></span>
          <textarea ng-model="effect.text" class="form-control mb-5"
            placeholder="Enter the plain text to synthesize into speech…"
            replace-variables menu-position="under"
            rows="4" cols="40"
          ></textarea>
        </div>
        <firebot-checkbox
          label="Enable Speech Synthesis Markup Language (SSML)"
          model="effect.ssml"
          ng-hide="effect.variableVoice === false &&\
 isJourneyVoice(effect.voiceName)"
          tooltip="SSML allows for advanced formatting such as pauses with\
 &lt;break&gt;, spelling out initialisms with &lt;say-as&gt;, or even multiple\
 voices or languages with &lt;voice&gt;."
        />
        <div ng-show="effect.ssml === true && effect.variableVoice === true"
          class="effect-info alert alert-warning"
        >
          <p>
            SSML support is limited with Studio voice models, and is completely
            unavailable for use with Journey voice models.
            <a class="clickable"
              ng-click="openLink('https://cloud.google.com/text-to-speech/docs/voice-types')"
              aria-label="Open a list of voice types and their limitations"
              uib-tooltip="https://cloud.google.com/text-to-speech/docs/voice-types"
            >
              More information
            </a>
          </p>
        </div>
        <div ng-show="effect.ssml === true">
          <div class="effect-info alert alert-warning">
            Warning: any dynamic text (such as <code>$chatMessage</code>)
            <em><strong>should</strong></em> be sanitized with
            <code>$encodeForSsml[…]</code> to avoid problems.
          </div>
          <span>
            <p>
              <a class="clickable" ng-click="openLink('https://cloud.google.com/text-to-speech/docs/ssml')"
                  aria-label="Open Google's speech synthesis markup language\
 reference in a web browser"
                  uib-tooltip="https://cloud.google.com/text-to-speech/docs/ssml"
              >
                SSML Reference
              </a>
              <i class="fad fa-external-link"></i>
            </p>
          </span>
        </div>
      </eos-container>

      <eos-container header="Voice Selection">
        <firebot-checkbox label="Enable variables for voice selection"
          model="effect.variableVoice" />
        <firebot-checkbox ng-show="effect.variableVoice === true"
          label="Use a backup voice" model="fallbackVoiceEnabled" />
        <div ng-show="voices.length === 0">
          <strong>
            Some functionality in this section is still being loaded. Please
            wait…
          </strong>
        </div>
        <div ng-show="voices.length && effect.variableVoice !== true">
          <h5>Voice Name</h5>
          <ui-select ng-model="effect.voiceName" theme="bootstrap">
            <ui-select-match placeholder="Select or search for a voice…"
            >{{$select.selected.name}}</ui-select-match>
            <ui-select-choices style="position: relative;"
              repeat="voice.name as voice in voices | filter: { name:\
 $select.search }"
            >
              <div ng-bind-html="voice.name | highlight: $select.search"></div>
              <small class="muted"><strong>{{getGenderName(voice.gender)}} |\
 {{voice.languageName}} | {{voice.type}} Category | {{voice.pricing}}\
 Pricing
              </strong></small>
            </ui-select-choices>
          </ui-select>
        </div>
        <div ng-show="effect.variableVoice === true">
          <div>
            <h5>Primary Voice</h5>
            <textarea ng-model="effect.voiceName" class="form-control"
              name="text" placeholder="Enter the desired voice name…"
              rows="1" cols="40" replace-variables menu-potion="under"
            ></textarea>
          </div>
          <div ng-show="voices.length && fallbackVoiceEnabled === true">
            <h5>Fallback Voice</h5>
            <ui-select ng-model="effect.fallbackVoiceName" theme="bootstrap"
              tooltip="Does this support a tooltip?"
            >
              <ui-select-match
                placeholder="Select or search for a fallback voice…"
              >{{$select.selected.name}}</ui-select-match>
              <ui-select-choices style="position: relative;"
                repeat="voiceInfo.name as voiceInfo in voices | filter: { name:\
 $select.fallbackSearch }"
              >
                <div ng-bind-html="voiceInfo.name | highlight:\
 $select.fallbackSearch"
                ></div>
                <small class="muted">
                  <strong>{{getGenderName(voiceInfo.gender)}} |\
 {{voiceInfo.languageName}} | {{voiceInfo.type}} Category |\
 {{voiceInfo.pricing}} Pricing</strong>
                </small>
              </ui-select-choices>
            </ui-select>
            <small class="muted">
              <strong>This voice will be used instead of the one above if the\
 primary voice variable does not expand to a valid voice name when the effect\
 is executed.</strong>
            </small>
          </div>
        </div>
        <div class="mt-5">
          <a class="clickable"
            ng-click="openLink('https://cloud.google.com/text-to-speech/docs/voices')"
            aria-label="Open a detailed list of voices with pre-generated\
 samples in your web browser"
            uib-tooltip="https://cloud.google.com/text-to-speech/docs/voices"
          >
            Voices Reference
          </a>
          <i class="fad fa-external-link"></i>
        </div>
      </eos-container>

      <eos-container header="General Settings" pad-top="true">
        <firebot-checkbox label="Wait for Playback to Finish"
          model="effect.waitForPlayback"  
          tooltip="Wait for the audio to play back entirely before allowing the\
 next effect to run."
        />
        <div class="mt-5">
          <h5>API Version</h5>
          <div class="btn-group" uib-dropdown>
            <button id="api-button" type="button" class="btn btn-default"
              data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"
              uib-dropdown-toggle
            >
              <span>{{getApiName(effect.apiVersion)}}</span>
              <span class="caret"></span>
            </button>
            <ul class="dropdown-menu" uib-dropdown-menu role="menu"
              aria-labelledby="api-button"
            >
              <li class="clickable" role="menuitem"
                ng-click="effect.apiVersion = apiVer.id"
                ng-repeat="apiVer in apiVersions track by apiVer.id"
              >
                <a>{{apiVer.name}}</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-5">
          <h5>Audio Encoding</h5>
          <div class="btn-group" uib-dropdown>
            <button id="fmt-button" type="button"
              class="btn btn-default dropdown-toggle" data-toggle="dropdown"
              aria-haspopup="true" aria-expanded="false" uib-dropdown-toggle
            >
              <span>{{getFormatName(effect.audioFormat)}}</span>
              <span class="caret"></span>
            </button>
            <ul class="dropdown-menu" uib-dropdown-menu role="menu"
              aria-labelledby="fmt-button"
            >
              <li class="clickable" role="menuitem"
                ng-click="effect.audioFormat = audFmt.id"
                ng-repeat="audFmt in audioFormats track by audFmt.id"
              >
                <a>{{audFmt.name}}</a>
              </li>
            </ul>
          </div>
          <div ng-show="effect.audioFormat" class="mt-2">
            <small class="muted">
              <strong>{{getFormatTooltip(effect.audioFormat)}}</strong>
            </small>
          </div>
        </div>
      </eos-container>

      <eos-container header="Audio Effects" pad-top="true">
        <h5>Amplitude Adjust</h5>
        <div
          uib-tooltip="The virtual microphone gain that the synthesis algorithm\
 is using in decibels (dB). Higher values will be louder and more distorted,\
 while lower values are quieter. Default: 0"
        >
          <div class="volume-slider-wrapper">
            <i class="fal fa-volume-down"></i>
            <!--
              "volume-low" has the large colored icon that I like better, but
              I can't figure out how to properly match the other icons with it.
            -->
            <rzslider rz-slider-model="effect.amplitudeAdjust"
              rz-slider-options="{floor: -96, ceil: 16, precision: 1,\
 step: 0.05}"
            ></rzslider>
            <i class="fal fa-volume-up"></i>
            <!-- "volume-high" -->
          </div>
          <div class="effect-info alert alert-warning"
            ng-show="effect.amplitudeAdjust && effect.amplitudeAdjust >= 10"
          >
            Warning: An amplitude adjustment larger than 10 is not recommended.
          </div>
        </div>
        <div ng-hide="isJourneyVoice(effect.voiceName)">
          <h5>Pitch Adjust</h5>
          <div class="volume-slider-wrapper">
            <i class="fal fa-chevron-double-down"></i>
            <rzslider rz-slider-model="effect.pitchAdjust"
              rz-slider-options="{floor: -20.0, ceil: 20.0, precision: 1,\
 step: 0.05}"
              uib-tooltip="Increase or decrease the pitch of the voice by this\
 many semitones. Default: 0"
              aria-label="How many semitones to decrease or increase the pitch\
 of the voice. The default value is zero"
            ></rzslider>
            <i class="fal fa-chevron-double-up"></i>
          </div>
          <div class="effect-info alert alert-warning"
            ng-show="effect.variableVoice === true && effect.pitchAdjust !== 0"
          >
            Warning: Journey voice models do not support pitch adjustment.
          </div>
        </div>
        <div ng-hide="isJourneyVoice(effect.voiceName)">
          <h5>Speaking Rate</h5>
          <div class="volume-slider-wrapper">
            <i class="fal fa-backward"></i>
            <!-- <i class="fal fa-turtle"></i> -->
            <rzslider rz-slider-model="effect.speakingRate"
              rz-slider-options="{floor: 0.25, ceil: 4, precision: 2, step:\
 0.05}"
              uib-tooltip="The rate that the text will be spoken at. Higher is\
 faster, while lower is slower. Default: 1"
              aria-label="The rate that the text will be spoken at. Higher is\
 faster, while lower is slower."
            ></rzslider>
            <i class="fal fa-forward"></i>
            <!--
              This rabbit is hard to see at this size, but maybe there's
              something better out there for use...
             <i class="fal fa-rabbit-fast"></i>
            -->
          </div>
          <div ng-show="effect.variableVoice === true &&\
 effect.speakingRate !== 1"
            class="effect-info alert alert-warning"
          >
            Warning: Journey voice models do not support speaking rate
            adjustment.
          </div>
        </div>
        <h5>Device Profiles</h5>
        <div>
          <span>
            TODO: PLACEHOLDER. There will be a UI here eventually for adding
            some more advanced audio effects based on device profiles.
          </span>
        </div>
        <div ng-show="areAnyEffectsCustomized()" class="mt-5">
          <button class="btn btn-default" ng-click="resetAudioEffects()">
            Reset Audio Effects to Defaults
          </button>
        </div>
      </eos-container>

      <eos-container header="Output Settings" pad-top="true">
        <eos-audio-output-device effect="effect"></eos-audio-output-device>
        <eos-overlay-instance
          ng-if="effect.audioOutputDevice &&\
 effect.audioOutputDevice.deviceId === 'overlay'"
          effect="effect" pad-top="true"
        ></eos-overlay-instance>
        <eos-container header="Volume" pad-top="true">
          <div class="volume-slider-wrapper">
            <i class="fal fa-volume-down volume-low"></i>
            <rzslider rz-slider-model="effect.outputVolume"
              rz-slider-options="{floor: 1, ceil: 10, precision: 1, step: 0.1}"
            ></rzslider>
            <i class="fal fa-volume-up volume-high"></i>
          </div>
        </eos-container>
      </eos-container>

      <eos-container header="Error Handling" pad-top="true">
        <firebot-checkbox
          label="Stop Effect List On Error"
          model="wantsStop"
          on-change="stopChanged(newValue)"
          tooltip="Request to stop future effects in the parent list from\
 running should an error occur."
        />
        <firebot-checkbox
          label="Bubble to Parent Effect Lists"
          model="wantsBubbleStop"
          on-change="bubbleChanged(newValue)"
          tooltip="Bubble the stop request up to all parent effect lists\
 should an error occur. Useful if nested within a Conditional Effect, or\
 a Preset Effects List, etc."
        />
      </eos-container>
    `,
  optionsController: (
    $scope: Scope,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backendCommunicator: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $rootScope: any,
  ) => {
    $scope.defaultSettings = Object.freeze<EffectData>({
      amplitudeAdjust: 0.0,
      apiVersion: "v1",
      audioFormat: "OGG_OPUS",
      audioOutputDevice: { deviceId: undefined, label: "App Default" },
      effectProfiles: [],
      fallbackVoiceName: undefined,
      language: "en-US",
      outputVolume: 5,
      overlayInstance: undefined,
      pitchAdjust: 0.0,
      speakingRate: 1.0,
      ssml: false,
      stopOnError: "false",
      text: "",
      variableVoice: false,
      voiceName: "en-US-Neural2-C",
      waitForPlayback: true,
    });
    // These arrays are sorted by the order they'll appear in any UI dropdowns.
    $scope.apiVersions = [
      { id: "v1", name: "Version 1" },
      { id: "v1beta1", name: "Version 1 Beta 1" },
    ];
    $scope.audioFormats = [
      { name: "Ogg Opus (Recommended)", id: "OGG_OPUS",
        tooltip: "The recommended option, with good quality and a decent\
 compression ratio, but may not be playable everywhere.",
      },
      { name: "16-bit WAV", id: "LINEAR16",
        tooltip: "Offers good quality, but comes with a larger file size.\
 Recommended when Ogg Opus is not available.",
      },
      { name: "MP3 (64 kbps)", id: "MP3_64_KBPS",
        tooltip: "Playable on virtually any device, but is only available from\
 the Version 1 Beta 1 API, and may be removed at some point in the future with\
 little warning.",
      },
      { name: "MP3 (32 kbps)", id: "MP3",
        tooltip: "Playable on virtually any device, but has a slightly larger\
 file size compared to Ogg Opus. Recommended if Ogg Opus is not available.",
      },
      { name: "G.711 A-law", id: "ALAW",
        tooltip: "Sounds like an European telephone call.",
      },
      { name: "G.711 μ-law", id: "MULAW",
        tooltip: "Sounds like an American telephone call.",
      },
    ];
    $scope.deviceProfiles = [
      { name: "Bluetooth® Speaker",
        id: "medium-bluetooth-speaker-class-device",
        icon: "fad fa-boombox",
        tooltip: "Simulates the voice playing through a larger Bluetooth®\
 speaker, such as an Amazon Echo Studio® or a Google Nest Audio® device.",
      },
      { name: "Car Stereo",
        id: "large-automotive-class-device",
        icon: "fad fa-car-crash",
        tooltip: "Simulates the voice playing through a premium car stereo\
 system.",
      },
      { name: "Headphones",
        id: "headphone-class-device",
        icon: "fad fa-headphones",
        tooltip: "Simulates the voice playing through a decent pair of\
 headphones or earbuds.",
      },
      { name: "Home Theater",
        id: "large-home-entertainment-class-device",
        icon: "fad fa-speakers",
        tooltip: "Simulates the voice playing through a premium home\
 entertainment system.",
      },
      { name: "Mini Bluetooth® Speaker",
        id: "small-bluetooth-speaker-class-device",
        icon: "fad fa-radio",
        tooltip: "Simulates the voice playing through a small-sized\
 Bluetooth® speaker, such as a Google Nest Mini® or an Amazon Echo Pop™.",
      },
      { name: "Phone Speaker",
        id: "handset-class-device",
        icon: "fad fa-mobile-alt",
        tooltip: "Simulates the voice playing through a smartphone speaker.",
      },
      { name: "Smart Watch",
        id: "wearable-class-device",
        icon: "fad fa-watch-fitness",
        tooltip: "Simulates the voice playing through a wearable or smart\
 watch-style device, like an Apple Watch® or a Google Pixel Watch™.",
      },
      { name: "Telephony",
        id: "telephony-class-application",
        icon: "fad fa-phone-office",
        tooltip: "Simulates the voice being used in an interactive voice\
 response system, like what a large call center would use to route inbound\
 calls.",
      },
    ];
    $scope.genders = [
      { id: "FEMALE", name: "Female" },
      { id: "MALE", name: "Male" },
      { id: "NEUTRAL", name: "Neutral" },
      { id: "SSML_VOICE_GENDER_UNSPECIFIED", name: "Unknown" },
    ];
    $scope.isIntegrationConfigured =
      backendCommunicator.fireEventSync(consts.signals.isIntegrationConfigured)
        === true;
    $scope.voices = backendCommunicator.fireEventSync("gcpttsGetVoices") ?? [];

    $scope.isJourneyVoice = (voiceName) => {
      return voiceName != null && voiceName.toLowerCase().includes("journey");
    };
    $scope.isStudioVoice = (voiceName) => {
      return voiceName != null && (
        voiceName.toLowerCase().includes("news") ||
        voiceName.toLowerCase().includes("studio")
      );
    };

    $scope.areAnyEffectsCustomized = () => {
      return ($scope.effect.effectProfiles.length > 0)
      || (
        $scope.effect.amplitudeAdjust !== $scope.defaultSettings.amplitudeAdjust
      )
      || ($scope.effect.pitchAdjust !== $scope.defaultSettings.pitchAdjust)
      || ($scope.effect.speakingRate !== $scope.defaultSettings.speakingRate);
    };
    $scope.getApiName = (apiId) => {
      return $scope.apiVersions.find(api => api.id === apiId)
        ?.name ?? "Unknown";
    };
    $scope.getEffectDescription = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)
        ?.tooltip ?? "Unknown";
    };
    $scope.getEffectName = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)
        ?.name ?? "Unknown";
    };
    $scope.getEffectIcon = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)
        ?.icon ?? "fad fa-question-square";
    };
    $scope.getFormatTooltip = (fmtId) => {
      return $scope.audioFormats.find(fmt => fmt.id === fmtId)
        ?.tooltip ?? "Unknown";
    };
    $scope.getFormatName = (fmtId) => {
      return $scope.audioFormats.find(fmt => fmt.id === fmtId)
        ?.name ?? "Unknown";
    };
    $scope.getGenderName = (genderId) => {
      return $scope.genders.find(gender => gender.id === genderId)
        ?.name ?? "Unknown";
    };
    $scope.openLink = (uri) => {
      $rootScope.openLinkExternally(uri);
    };
    $scope.resetAudioEffects = () => {
      $scope.effect.amplitudeAdjust = $scope.defaultSettings.amplitudeAdjust;
      $scope.effect.effectProfiles = $scope.defaultSettings.effectProfiles;
      $scope.effect.pitchAdjust = $scope.defaultSettings.pitchAdjust;
      $scope.effect.speakingRate = $scope.defaultSettings.speakingRate;
    };

    $scope.bubbleChanged = (newValue: boolean) => {
      if (newValue) {
        if ($scope.effect.stopOnError === "stop") {
          $scope.effect.stopOnError = "bubbleStop";
        } else {
          $scope.effect.stopOnError = "bubble";
        }
      } else {
        if ($scope.effect.stopOnError === "bubbleStop") {
          $scope.effect.stopOnError = "stop";
        } else {
          $scope.effect.stopOnError = "false";
        }
      }
    };
    $scope.stopChanged = (newValue: boolean) => {
      if (newValue) {
        if ($scope.effect.stopOnError === "bubble") {
          $scope.effect.stopOnError = "bubbleStop";
        } else {
          $scope.effect.stopOnError = "stop";
        }
      } else {
        if ($scope.effect.stopOnError === "bubbleStop") {
          $scope.effect.stopOnError = "bubble";
        } else {
          $scope.effect.stopOnError = "false";
        }
      }
    };

    $scope.effect ??= $scope.defaultSettings;

    if ($scope.effect.amplitudeAdjust === null
      || $scope.effect.amplitudeAdjust === undefined
      || typeof $scope.effect.amplitudeAdjust !== "number"
      || !Number.isFinite($scope.effect.amplitudeAdjust)
      || $scope.effect.amplitudeAdjust < -96
      || $scope.effect.amplitudeAdjust > 16
    ) {
      $scope.effect.amplitudeAdjust = $scope.defaultSettings.amplitudeAdjust;
    }
    $scope.effect.apiVersion ??= $scope.defaultSettings.apiVersion;
    $scope.effect.audioFormat ??= $scope.defaultSettings.audioFormat;
    $scope.effect.audioOutputDevice ??=
      $scope.defaultSettings.audioOutputDevice;
    $scope.effect.effectProfiles ??= $scope.defaultSettings.effectProfiles;
    $scope.effect.language ??= $scope.defaultSettings.language;
    if ($scope.effect.outputVolume === null
      || $scope.effect.outputVolume === undefined
      || typeof $scope.effect.outputVolume !== "number"
      || !Number.isFinite($scope.effect.outputVolume)
      || $scope.effect.outputVolume <= 0
      || $scope.effect.outputVolume > 10
    ) {
      $scope.effect.outputVolume = $scope.defaultSettings.outputVolume;
    }
    // overlayInstance is virtually untouchable
    if ($scope.effect.pitchAdjust === null
      || $scope.effect.pitchAdjust === undefined
      || typeof $scope.effect.pitchAdjust !== "number"
      || !Number.isFinite($scope.effect.pitchAdjust)
      || $scope.effect.pitchAdjust < -20
      || $scope.effect.pitchAdjust > 20
    ) {
      $scope.effect.pitchAdjust = $scope.defaultSettings.pitchAdjust;
    }
    if ($scope.effect.speakingRate === null
      || $scope.effect.speakingRate === undefined
      || typeof $scope.effect.speakingRate !== "number"
      || !Number.isFinite($scope.effect.speakingRate)
      || $scope.effect.speakingRate < 0.25
      || $scope.effect.speakingRate > 4
    ) {
      $scope.effect.speakingRate = $scope.defaultSettings.speakingRate;
    }
    $scope.effect.ssml ??= $scope.defaultSettings.ssml;
    $scope.effect.stopOnError ??= $scope.defaultSettings.stopOnError;
    $scope.effect.text ??= $scope.defaultSettings.text;
    $scope.effect.variableVoice ??= $scope.defaultSettings.variableVoice;
    $scope.effect.voiceName ??= $scope.defaultSettings.voiceName;
    if ($scope.effect.waitForPlayback === null
      || $scope.effect.waitForPlayback === undefined
      || typeof $scope.effect.waitForPlayback !== "boolean"
    ) {
      $scope.effect.waitForPlayback = $scope.defaultSettings.waitForPlayback;
    }
    if ($scope.effect.variableVoice === null
      || $scope.effect.variableVoice === undefined
      || typeof $scope.effect.variableVoice !== "boolean"
    ) {
      $scope.effect.variableVoice = $scope.effect.fallbackVoiceName != null
        || $scope.effect.voiceName.includes("$");
    }
    if ($scope.effect.variableVoice) {
      $scope.effect.fallbackVoiceName ??=
        $scope.defaultSettings.fallbackVoiceName;
    }

    $scope.fallbackVoiceEnabled = ($scope.effect.variableVoice === true
      && $scope.effect.fallbackVoiceName != null);
    $scope.wantsBubbleStop = ($scope.effect.stopOnError === "bubble"
      || $scope.effect.stopOnError === "bubbleStop");
    $scope.wantsStop = ($scope.effect.stopOnError === "stop"
      || $scope.effect.stopOnError === "bubbleStop");
  },
  optionsValidator: (effect, $scope) => {
    const errors = [];
    if (effect == null) {
      errors.push("Something went wrong internally, the effect is nullish");
      return errors;
    }

    if (!effect.text || effect.text.length < 1) {
      errors.push("Please input some text to speak aloud.");
    }
    // The length chosen here is arbitrary, but a two-letter variable /could/
    // be acceptable (with a sigh). One letter ($a or $b, etc) is too short.
    if (!effect.voiceName || effect.variableVoice === true
      && effect.voiceName.length < 3) {
      errors.push("Please specify a voice to use.");
    }
    if (errors.length > 0) {
      return errors;
    }

    if (effect.audioFormat === "MP3_64_KBPS"
      && effect.apiVersion !== "v1beta1"
    ) {
      errors.push("MP3 64 kbps encoding is only available in the v1beta1 API");
    }
    if (effect.amplitudeAdjust !== undefined && (
      !Number.isFinite(effect.amplitudeAdjust) ||
      effect.amplitudeAdjust < -96 || effect.amplitudeAdjust > 16
    )) {
      errors.push("Amplitude adjustment is outside acceptable range\
 (-96 to 16)");
    }
    if (effect.pitchAdjust !== undefined && (
      !Number.isFinite(effect.pitchAdjust) ||
      effect.pitchAdjust < -20 || effect.pitchAdjust > 20
    )) {
      errors.push("Pitch adjustment is outside acceptable range (-20 to 20)");
    }
    if (effect.speakingRate !== undefined && (
      !Number.isFinite(effect.speakingRate) ||
      effect.speakingRate < 0.25 || effect.speakingRate > 4.0
    )) {
      errors.push("Speaking rate is outside acceptable range (0.25 to 4)");
    }

    if (effect.ssml === true && (
      effect.variableVoice === true || !$scope.isJourneyVoice(effect.voiceName)
    )) {
      const openTag = /<speak>/i;
      const closeTag = /<\/speak>/i;
      if (!openTag.test(effect.text)) {
        errors.push("Missing opening SSML &lt;speak&gt; tag");
      }
      if (!closeTag.test(effect.text)) {
        errors.push("Missing closing SSML &lt;/speak&gt; tag");
      }
    }
    if (effect.variableVoice !== true && effect.voiceName) {
      if ($scope.voices.length > 0 &&
        !$scope.voices.some(voice => voice.name === effect.voiceName)
      ) {
        errors.push(`Voice "${effect.voiceName}" is unknown`);
      }
      if ($scope.isJourneyVoice(effect.voiceName)) {
        if (effect.ssml) {
          errors.push("Journey voice models do not support SSML markup");
        }
        if (effect.audioFormat === "ALAW") {
          errors.push("Journey voice models do not support A-Law encoding");
        }
        if (effect.pitchAdjust !== undefined && effect.pitchAdjust !== 0) {
          errors.push("Journey voice models do not support pitch adjustment");
        }
        if (effect.speakingRate !== undefined && effect.speakingRate !== 1) {
          errors.push("Journey voice models do not support rate adjustment");
        }
      }
      if ($scope.isStudioVoice(effect.voiceName) && effect.ssml) {
        if (effect.text.toLowerCase().includes("<emphasis")) {
          errors.push("Studio voices do not support <emphasis> SSML tags");
        }
        if (effect.text.toLowerCase().includes("<mark")) {
          errors.push("Studio voices do not support <mark> SSML tags");
        }
        if (effect.text.toLowerCase().includes("<lang")) {
          errors.push("Studio voices do not support <lang> SSML tags");
        }
        if (effect.text.toLowerCase().includes("<prosody")) {
          const prosodyTags = effect.text.toLowerCase().split("<prosody");
          for (const tag of prosodyTags) {
            const tagEndIdx = tag.indexOf(">");
            if (tagEndIdx < 0) {
              errors.push("Unterminated <prosody> SSML tag");
              break;
            }
            if (tag.slice(0, tagEndIdx).includes("pitch")) {
              errors.push("Studio voices do not support <prosody> pitch\
 parameter");
              break;
            }
          }
        }
      }
    }

    return errors;
  },
  onTriggerEvent: async (event) => {
    ///////////////////////////////
    // Step 0: sanitize inputs
    ///////////////////////////////
    const { effect } = event;
    const logger = new ContextLogger("gcptts.effect.synthesize");
    // Assume a failure result from the get-go.
    const result = <TriggerResponse> {
      execution: {
        bubbleStop: event.effect.stopOnError === "bubble"
          || event.effect.stopOnError === "bubbleStop",
        stop: event.effect.stopOnError === "stop"
          || event.effect.stopOnError === "bubbleStop",
      },
      outputs: {
        ttsUsage: {
          billedUnits: 0,
          pricingTier: null,
          voiceName: null,
          voiceType: null,
        },
      },
      success: false,
    };

    const { dataProvider, firebotSettings, settingsProvider } = customPlugin;
    const { frontendCommunicator, path, resourceTokenManager } = customPlugin;

    if (!effect.voiceName || !dataProvider.isKnownVoiceName(effect.voiceName)) {
      if (effect.variableVoice && effect.fallbackVoiceName
        && dataProvider.isKnownVoiceName(effect.fallbackVoiceName)
      ) {
        effect.voiceName = effect.fallbackVoiceName;
        logger.warn(`Primary voice unavailable, falling back to\
 "${effect.fallbackVoiceName}"`);
      } else {
        logger.error(`Unknown voice (${(effect.voiceName ?? "null")}), and the\
 fallback voice was undefined or unknown`);
        return result;
      }
    }

    // tack on voice info, but continue assuming failure
    result.outputs.ttsUsage.voiceName = effect.voiceName;
    result.outputs.ttsUsage.voiceType =
      dataProvider.getVoiceStyle(effect.voiceName);


    ///////////////////////////////
    // Step 1: synthesize audio and write it to a file.
    ///////////////////////////////
    const audioFormat = audioFileExts.find(fmtDef =>
      fmtDef.id === effect.audioFormat) || { id: "OGG_OPUS", ext: "ogg" };
    const filePath = path.join(settingsProvider.audioFolderPath,
      `tts${uuid()}.${audioFormat.ext}`);
    try {
      const api = effect.apiVersion === "v1beta1"
        ? googleCloudApi.textToSpeech.v1beta1
        : googleCloudApi.textToSpeech.v1;
      const audioContent = await api.text.synthesize(
        {
          ...(effect.ssml === true
            && { ssml: effect.text }
            || { text: effect.text }
          ),
        },
        {
          languageCode: effect.language
            ?? dataProvider.getVoiceLocaleInfo(effect.voiceName ?? "")?.id
            ?? "",
          name: effect.voiceName,
        },
        {
          audioEncoding: audioFormat.id,
          ...(effect.effectProfiles.length > 0
            && { effectsProfileId: effect.effectProfiles}),
          ...(effect.pitchAdjust && { pitch: effect.pitchAdjust }),
          ...(effect.speakingRate && effect.speakingRate !== 1
            && { speakingRate: effect.speakingRate }),
          ...(effect.amplitudeAdjust
            && { volumeGainDb: effect.amplitudeAdjust }),
        },
      );
      if (audioContent == null || audioContent.length < 1) {
        logger.warn(`Got no response data from\
 ${effect.apiVersion}/text/synthesize`);
        return result;
      }

      // It has now been billed out, but there's still plenty of failure
      // opportunities... tack on billing info.
      //
      // Standard and Wavenet both bill per character, others bill per byte:
      // https://cloud.google.com/text-to-speech/pricing
      const voiceStyle = dataProvider.getVoiceStyle(effect.voiceName);
      const voiceTier = dataProvider.getVoicePricing(effect.voiceName);
      result.outputs.ttsUsage.billedUnits =
        voiceStyle === "Standard" || voiceStyle === "Wavenet" ?
          effect.text.length : new Blob([effect.text]).size;
      result.outputs.ttsUsage.pricingTier = voiceTier;

      // Send off a billing notification event
      customPlugin.eventManager.triggerEvent(consts.EVENT_SOURCE_ID,
        consts.UNITS_BILLED_EVENT_ID, <UnitsBilled> result.outputs.ttsUsage,
      );

      await fsp.writeFile(filePath, Buffer.from(audioContent, 'base64'),
        { encoding: "binary", flush: true, mode: 0o644 });
      const fileStats = await fsp.stat(filePath);
      logger.debug(`wrote audio file to ${filePath} of size ${fileStats.size}`);
    } catch (err) {
      logger.errorEx("Failed to synthesize audio or write it to file",
        err as Error, err as Error);
      return result;
    }


    ///////////////////////////////
    // Step 2: determine the audio file's playback length
    ///////////////////////////////
    let durationInSeconds = 0;
    try {
      // get the duration of this sound file
      durationInSeconds = await frontendCommunicator.fireEventAsync<number>(
        "getSoundDuration", { format: audioFormat.ext, path: filePath },
      );
    } catch (err) {
      logger.warnEx("Failed to determine audio file duration, going to blindly\
 assume 30 seconds", err as Error);
    }
    if (durationInSeconds <= 0) {
      durationInSeconds = 30;
    }
    const durationInMils = 1000 * durationInSeconds;


    ///////////////////////////////
    // Step 3: play the audio file
    ///////////////////////////////
    try {
      const soundData: OverlayData = {
        audioOutputDevice: (effect.audioOutputDevice &&
          effect.audioOutputDevice.label !== "App Default"
        ) ? effect.audioOutputDevice
          : firebotSettings.getAudioOutputDevice(),
        filepath: filePath,
        format: audioFormat.ext,
        maxSoundLength: durationInSeconds,
        volume: effect.outputVolume ?? 5,
      };

      if (soundData.audioOutputDevice.deviceId === "overlay") {
        soundData.resourceToken = resourceTokenManager.storeResourcePath(
          soundData.filepath, durationInSeconds);

        if (firebotSettings.useOverlayInstances() && effect.overlayInstance &&
          firebotSettings.getOverlayInstances().includes(effect.overlayInstance)
        ) {
          soundData.overlayInstance = effect.overlayInstance;
        }

        event.sendDataToOverlay(soundData, soundData.overlayInstance);
        logger.debug("sent soundData to overlay");
      } else {
        frontendCommunicator.send("playsound", soundData);
        logger.debug("sent soundData to playsound");
      }
    } catch (err) {
      logger.errorEx("Error submitting audio for playback",
        err as Error, err as Error);

      try {
        await fsp.unlink(filePath);
      } catch {
      }
      return result;
    }


    // Primary objectives are all now completed.
    result.execution = undefined;
    result.success = true;


    ///////////////////////////////
    // Step 4: remove the audio file after it's done playing
    ///////////////////////////////
    if (effect.waitForPlayback !== false) {
      // Wait for it to finish playing, then delete it.
      await wait(durationInMils).then(async function () {
        try {
          await fsp.unlink(filePath);
          logger.debug(`Deleted sync audio file "${filePath}"`);
        } catch (err) {
          logger.warnEx(
            `Failed to remove audio file after synchronous play; "${filePath}"\
 can be manually deleted at your leisure.`,
            err as Error, err as Error,
          );
        }
      });
    } else {
      // Fire and forget.
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted async audio file "${filePath}"`);
        } catch (err) {
          logger.warnEx(
            `Failed to remove audio file after asynchronous play; "${filePath}"\
 can be manually deleted at your leisure`,
            err as Error,
          );
        }
      }, durationInMils + 1000);
    }

    ///////////////////////////////
    // Step 5: **profit**
    ///////////////////////////////
    logger.debug(`Finished synthesizing ${result.outputs.ttsUsage.billedUnits}\
 characters or bytes using ${effect.voiceName}.`);
    return result;
  },
};

export default synthesizeEffect;
