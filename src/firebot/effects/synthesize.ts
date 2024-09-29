import { EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { v4 as uuid } from "uuid";
import fs from "fs";
import fsp from "fs/promises";

import { BetterEffectTriggerResult, BetterEffectType } from "./better-effects";
import consts from "../../consts";
import customPlugin from "../../main";
import google from "../../gcp";
import { wait } from "../../utils";
import { ExtendedVoiceInfo } from "../../types";
import { ContextLogger } from "../../context-logger";

// TODO: cull deprecated properties after a couple of pre-releases once everyone's updated beyond v0.3, maybe just prior to 1.0 in case I want to change more?.
interface EffectData extends Record<string, unknown> {
  /** MIGRATE . Adjust the apparent amplitude of the voice. Default: 0.0. Migrated from effectVolume. Remove ? once migration completed. */
  amplitudeAdjust?: number;
  /** The text-to-speech api revision to use. Default: v1. Acceptable values: v1, v1b1. */
  apiVersion: string;
  /** The audio format specifier to use. Default: oggopus */
  audioFormat: "ALAW" | "LINEAR16" | "MP3" | "MP3_64_KBPS" | "MULAW" | "OGG_OPUS";
  /** The audio output device to speak the text out with: e.g. "App Default", "overlay", "Headphones", "Speakers", etc. */
  audioOutputDevice?: {
    deviceId?: string;
    label?: string;
  };
  /** An array of available speech synthesis effect profiles used to simulate listening on various audio devices. Default: []. */
  effectProfiles: string[];
  /** The voice to fallback to if variableVoice is set, and voiceName doesn't resolve to a legit voice. */
  fallbackVoiceName?: string;
  /** The BCP-47 language and optional region code to use. When undefined or null, the language will be inferred from voiceName. */
  language?: string;
  /** The volume to play the resulting sample at. Default 5.0, range 1.0 to 10.0. */
  outputVolume: number;
  /** Used to specify which overlay instance to send audio to when overlay instancing has been enabled. */
  overlayInstance?: string;
  /** MIGRATE . The pitch adjustment to use. Default 0.0. Migrated from effectPitch, remove ? once migration completed. */
  pitchAdjust?: number;
  /** MIGRATE . The speaking rate to use. Default 1.0. Migrated from effectRate. Remove ? once migration completed. */
  speakingRate?: number;
  /** Is SSML parsing enabled in the input text. Default: false. */
  ssml: boolean;
  /** How to treat errors, default false. true or "true" will stop, "bubble" will both stop and bubble stop. */
  stopOnError?: false | "stop" | "bubble" | "bubbleStop";
  /** The input text or SSML to synthesize. */
  text: string;
  /** Whether variables are enabled for voiceName. Default: false. If true, language will always be undefined until the effect is run. */
  variableVoice?: boolean;
  /** MIGRATE . The name of the voice to use to synthesize the speech. Migrated from voice. Remove ? once migration completed. */
  voiceName?: string;
  /** Whether or not to wait for playback to finish before marking the effect as completed. Default: true. */
  waitForPlayback?: boolean;

  /** @deprecated @see pitchAdjust MIGRATE The pitch adjustment to use. Default: 0.0. */
  effectPitch?: number;
  /** @deprecated @see speakingRate MIGRATE The speaking rate to use. Default: 1.0. */
  effectRate?: number;
  /** @deprecated @see amplitudeAdjust MIGRATE Adjust the apparent amplitude gain of the voice. Default: 0.0. */
  effectVolume?: number;
  /** @deprecated @see voiceName MIGRATE The former property that held the name of the voice to use to synthesize the speech. */
  voice?: string;
};
interface EffectOutput extends Record<string, unknown> {
  ttsUsage: {
    /** The number of characters or bytes billed out. */
    billedUnits: number,
    /** The pricing tier that was billed out, or `null` when nothing was billed. */
    pricingBucket: string | null,
    /** The voice name used to synthesize speech, excluding any SSML voice changes. */
    voiceName: string | null,
    /** The class of voice that was used to synthesize speech, excluding any SSML voice changes. */
    voiceType: string | null,
  },
};
interface EffectTriggerResult extends BetterEffectTriggerResult<EffectOutput> { };
interface Scope extends EffectScope<EffectData> {
  // "read-only" properties

  defaultSettings: EffectData;
  apiVersions: { id: string, name: string }[];
  audioFormats: { id: string, name: string, tooltip: string }[];
  deviceProfiles: { id: string, icon: string, name: string, tooltip: string }[];
  genders: { id: string, name: string }[];
  voices: ExtendedVoiceInfo[];

  // "read-write" intermediary properties

  /** Whether the fallbackVoiceName input should be shown. */
  fallbackVoiceEnabled: boolean;
  /** A boolean value indicating if the ApiKey integration has been configured. */
  isApikeyConfigured: boolean;
  /** A boolean value indicating if the OAuth integration has been configured. */
  isOauthConfigured: boolean;
  /** Whether a bubble stop request will be emitted after an error. Helper cache for effect.stopOnError. */
  wantsBubbleStop: boolean;
  /** Whether a stop request will be emitted after an error. Helper cache for effect.stopOnError. */
  wantsStop: boolean;

  // functions
  areAnyEffectsCustomized: () => boolean;
  getApiName: (apiId: string) => string;
  getEffectDescription: (deviceProfileId: string) => string;
  getEffectIcon: (deviceProfileId: string) => string;
  getEffectName: (deviceProfileId: string) => string;
  getFormatTooltip: (fmtId: string) => string;
  getFormatName: (fmtId: string) => string;
  getGenderName: (genderId: string) => string;
  // loadVoices: () => void;
  openLink: (uri: string) => void;
  resetAudioEffects: () => void;

  bubbleChangeD: (newValue: boolean) => void;
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

  resourceToken?: string;
  overlayInstance?: string;
};

const audioFileExts = Object.freeze<{ id: "ALAW" | "LINEAR16" | "MP3" | "MP3_64_KBPS" | "MULAW" | "OGG_OPUS", ext: string }[]>([
  { id: "ALAW", ext: "wav" },
  { id: "LINEAR16", ext: "wav" },
  { id: "MP3", ext: "mp3" },
  { id: "MP3_64_KBPS", ext: "mp3" },
  { id: "MULAW", ext: "wav" },
  { id: "OGG_OPUS", ext: "ogg" },
]);

const synthesizeEffect: BetterEffectType<EffectData, Scope, EffectOutput, OverlayData> = {
  definition: {
    id: consts.TTS_EFFECT_ID,
    name: "Text-To-Speech (Google Cloud)",
    categories: ["fun", "integrations"],
    description: "Have firebot read out some text using the revised Google Cloud TTS plugin.",
    hidden: false,
    icon: "fad fa-microphone-alt",
    outputs: [
      {
        label: "Usage Info",
        description: "An object containing information about the TTS request including properties: `billedUnits` (number), `pricingBucket` (string), `voiceName` (string), and `voiceType` (string).",
        defaultName: "ttsUsage",
      },
    ],
  },
  optionsTemplate:
    `
      <eos-container header="Configuration Required" ng-show="!isApikeyConfigured && !isOauthConfigured">
        <div class="effect-info alert alert-warning">
          This effect requires the Google Cloud integrations to be configured before it can execute. Visit <strong>Settings</strong> &gt; <strong>Integrations</strong> to configure it.
        </div>
      </eos-container>

      <eos-container header="Input Text" pad-top="!isApikeyConfigured && !isOauthConfigured">
        <div ng-show="effect.ssml === true" class="mt-2">
          <span><p>The SSML-formatted text to synthesize into speech:</p></span>
          <textarea ng-model="effect.text" class="form-control mb-5" name="text" placeholder="Enter the SSML-formatted text to synthesize into speech, including the required enclosing &lt;speak&gt; and &lt;/speak&gt; tags…" rows="4" cols="40" replace-variables menu-position="under"></textarea>
        </div>
        <div ng-show="effect.ssml !== true">
          <span><p>The plain text to synthesize into speech:</p></span>
          <textarea ng-model="effect.text" class="form-control mb-5" name="text" placeholder="Enter the plain text to synthesize into speech…" rows="4" cols="40" replace-variables menu-position="under"></textarea>
        </div>
        <firebot-checkbox
          label="Enable Speech Synthesis Markup Language (SSML)"
          model="effect.ssml"
          tooltip="SSML allows for advanced formatting such as pauses with &lt;break&gt;, spelling out initialisms with &lt;say-as&gt;, or even multiple voices or languages with &lt;voice&gt;."
        />
        <div ng-show="effect.ssml === true">
          <div class="effect-info alert alert-warning">
            Warning: any untrusted text (such as <code>$chatMessage</code>) <em><strong>should</strong></em> be sanitized with <code>$encodeForSsml[…]</code> to avoid problems.
          </div>
          <span>
            <p>
              <a class="clickable" ng-click="openLink('https://cloud.google.com/text-to-speech/docs/ssml')"
                  aria-label="Open Google's speech synthesis markup language reference in a web browser"
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
        <firebot-checkbox label="Enable variables for voice selection" model="effect.variableVoice" />
        <firebot-checkbox ng-show="effect.variableVoice === true" label="Use a backup voice" model="fallbackVoiceEnabled" />
        <div ng-show="voices.length === 0">
          <span><p><strong>Some functionality in this section is still being loaded. Please wait…</strong></p></span>
        </div>
        <div ng-show="voices.length && effect.variableVoice !== true">
          <h5>Voice Name</h5>
          <ui-select ng-model="effect.voiceName" theme="bootstrap">
            <ui-select-match placeholder="Select or search for a voice…">{{$select.selected.name}}</ui-select-match>
            <ui-select-choices repeat="voice.name as voice in voices | filter: { name: $select.search }" style="position: relative;">
              <div ng-bind-html="voice.name | highlight: $select.search"></div>
              <small class="muted"><strong>{{getGenderName(voice.gender)}} | {{voice.languageName}} | {{voice.type}} Category | {{voice.pricing}} Pricing</strong></small>
            </ui-select-choices>
          </ui-select>
        </div>
        <div ng-show="effect.variableVoice === true">
          <div>
            <h5>Primary Voice</h5>
            <textarea ng-model="effect.voiceName" class="form-control" name="text" placeholder="Enter the desired voice name…" rows="1" cols="40" replace-variables menu-potion="under"></textarea>
          </div>
          <div ng-show="voices.length && fallbackVoiceEnabled === true">
            <h5>Fallback Voice</h5>
            <ui-select ng-model="effect.fallbackVoiceName" theme="bootstrap" tooltip="Does this support a tooltip?">
              <ui-select-match placeholder="Select or search for a fallback voice…">{{$select.selected.name}}</ui-select-match>
              <ui-select-choices repeat="voiceInfo.name as voiceInfo in voices | filter: { name: $select.fallbackSearch }" style="position: relative;">
                <div ng-bind-html="voiceInfo.name | highlight: $select.fallbackSearch"></div>
                <small class="muted"><strong>{{getGenderName(voiceInfo.gender)}} | {{voiceInfo.languageName}} | {{voiceInfo.type}} Category | {{voiceInfo.pricing}} Pricing</strong></small>
              </ui-select-choices>
            </ui-select>
            <small class="muted"><strong>This voice will be used instead of the one above if the primary voice variable does not expand to a valid voice name when the effect is executed.</strong></small>
          </div>
        </div>
        <div class="mt-5">
          <a class="clickable"
            ng-click="openLink('https://cloud.google.com/text-to-speech/docs/voices')"
            aria-label="Open a detailed list of voices with pre-generated samples in a web browser"
            uib-tooltip="https://cloud.google.com/text-to-speech/docs/voices"
          >
            Voices Reference
          </a>
          <i class="fad fa-external-link"></i>
        </div>
      </eos-container>

      <eos-container header="General Settings" pad-top="true">
        <firebot-checkbox label="Wait for Playback to Finish" tooltip="Wait for the audio to play back entirely before allowing the next effect to run." model="effect.waitForPlayback" />
        <div class="mt-5">
          <h5>API Version</h5>
          <div class="btn-group" uib-dropdown>
            <button id="api-button" type="button" class="btn btn-default" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" uib-dropdown-toggle>
              <span>{{getApiName(effect.apiVersion)}}</span>
              <span class="caret"></span>
            </button>
            <ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="api-button">
              <li class="clickable" role="menuitem" ng-repeat="apiVer in apiVersions track by apiVer.id" ng-click="effect.apiVersion = apiVer.id">
                <a>{{apiVer.name}}</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-5">
          <h5>Audio Encoding</h5>
          <div class="btn-group" uib-dropdown>
            <button id="fmt-button" type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" uib-dropdown-toggle>
              <span>{{getFormatName(effect.audioFormat)}}</span>
              <span class="caret"></span>
            </button>
            <ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="fmt-button">
              <li class="clickable" role="menuitem" ng-repeat="audFmt in audioFormats track by audFmt.id" ng-click="effect.audioFormat = audFmt.id">
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
        <div uib-tooltip="The virtual microphone gain that the synthesis algorithm is using in decibels (dB). Higher values will be louder and more distorted, while lower values are quieter. Default: 0">
          <div class="volume-slider-wrapper">
            <i class="fal fa-volume-down"></i> <!-- "volume-low" For the large colored icons that I like better, but can't figure out how to match the other icons with. -->
            <rzslider rz-slider-model="effect.amplitudeAdjust" rz-slider-options="{floor: -96, ceil: 16, precision: 1, step: 0.05}"></rzslider>
            <i class="fal fa-volume-up"></i> <!-- "volume-high" -->
          </div>
          <div class="effect-info alert alert-warning" ng-show="effect.amplitudeAdjust && effect.amplitudeAdjust >= 10">
            Warning: An amplitude adjustment larger than 10 is not recommended.
          </div>
        </div>
        <h5>Pitch Adjust</h5>
        <div uib-tooltip="Pitch effects are not usable with Journey voices" aria-label="Pitch effects are not usable with Journey voices">
          <div class="volume-slider-wrapper">
            <i class="fal fa-chevron-double-down"></i>
            <rzslider rz-slider-model="effect.pitchAdjust" rz-slider-options="{floor: -20.0, ceil: 20.0, precision: 1, step: 0.05}"></rzslider>
            <i class="fal fa-chevron-double-up"></i>
          </div>
        </div>
        <h5>Speaking Rate</h5>
        <div uib-tooltip="The rate that the text will be spoken at. Higher is faster, while lower is slower. Default: 1" aria-label="The rate that the text will be spoken at. Higher is faster, while lower is slower.">
          <div class="volume-slider-wrapper">
            <!-- <i class="fal fa-turtle"></i> -->
            <i class="fal fa-backward"></i>
            <rzslider rz-slider-model="effect.speakingRate" rz-slider-options="{floor: 0.25, ceil: 4, precision: 2, step: 0.05}"></rzslider>
            <!-- This rabbit is hard to see at this size, but maybe there's something better out there... <i class="fal fa-rabbit-fast"></i> -->
            <i class="fal fa-forward"></i>
          </div>
        </div>
        <h5>Device Profiles</h5>
        <div>
          <span>TODO: PLACEHOLDER. There will be a UI here eventually for adding some more advanced audio effects based on device profiles. Dynamic list control incoming...</span>
        </div>
        <div ng-show="areAnyEffectsCustomized()" class="mt-5">
          <button class="btn btn-default" ng-click="resetAudioEffects()">Reset Audio Effects to Defaults</button>
        </div>
      </eos-container>

      <eos-container header="Output Settings" pad-top="true">
        <eos-audio-output-device effect="effect"></eos-audio-output-device>
        <eos-overlay-instance ng-if="effect.audioOutputDevice && effect.audioOutputDevice.deviceId === 'overlay'" effect="effect" pad-top="true"></eos-overlay-instance>
        <eos-container header="Volume" pad-top="true">
          <div class="volume-slider-wrapper">
            <i class="fal fa-volume-down volume-low"></i>
            <rzslider rz-slider-model="effect.outputVolume" rz-slider-options="{floor: 1, ceil: 10, precision: 1, step: 0.1}"></rzslider>
            <i class="fal fa-volume-up volume-high"></i>
          </div>
        </eos-container>
      </eos-container>

      <eos-container header="Error Handling" pad-top="true">
        <firebot-checkbox
          label="Stop Effect List On Error"
          model="wantsStop"
          on-change="stopChanged(newValue)"
          tooltip="Request to stop future effects in the parent list from running should an error occur."
        />
        <firebot-checkbox
          label="Bubble to Parent Effect Lists"
          model="wantsBubbleStop"
          on-change="bubbleChanged(newValue)"
          tooltip="Bubble the stop request up to all parent effect lists should an error occur. Useful if nested within a Conditional Effect, or Preset Effects List, etc."
        />
      </eos-container>
    `,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionsController: ($q: any, $rootScope: any, $scope: Scope, backendCommunicator: any) => {
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
      stopOnError: false,
      text: "",
      variableVoice: false,
      voiceName: "en-US-Neural2-C",
      waitForPlayback: true,

      // MIGRATE
      effectPitch: undefined,
      effectVolume: undefined,
      effectRate: undefined,
      voice: undefined,
    });
    // These arrays are sorted by the order they'll appear in any UI dropdowns, such as by name ASC.
    $scope.apiVersions = [
      { id: "v1", name: "Version 1" },
      { id: "v1b1", name: "Version 1 Beta 1" },
    ];
    $scope.audioFormats = [
      { id: "OGG_OPUS", name: "Ogg Opus (Recommended)", tooltip: "The recommended option, with good quality and a decent compression ratio, but may not be playable everywhere." },
      { id: "LINEAR16", name: "16-bit WAV (uncompressed)", tooltip: "Offers very good quality, but comes with a larger file size. Recommended if Ogg Opus is not available." },
      { id: "MP3_64_KBPS", name: "MP3 (64 kbps)", tooltip: "Playable on virtually any device, but is only available from the Version 1 Beta 1 API and may disappear at any point without warning." },
      { id: "MP3", name: "MP3 (32 kbps)", tooltip: "Is playable on virtually any device, but has a larger file size compared to Ogg Opus. Recommended if Ogg Opus is not available." },
      { id: "ALAW", name: "G.711 A-law", tooltip: "Sounds like an European telephone call. There are likely better options available for use." },
      { id: "MULAW", name: "G.711 μ-law", tooltip: "Sounds like an American telephone call. There are likely better options available for use." },
    ];
    $scope.deviceProfiles = [
      { id: "medium-bluetooth-speaker-class-device", icon: "fad fa-boombox", name: "Bluetooth® Speaker", tooltip: "Simulates the voice playing through a larger Bluetooth® speaker, such as an Amazon Echo Studio® or a Google Nest Audio® device." },
      { id: "large-automotive-class-device", icon: "fad fa-car-crash", name: "Car Stereo", tooltip: "Simulates the voice playing through a premium car stereo system." },
      { id: "headphone-class-device", icon: "fad fa-headphones", name: "Headphones", tooltip: "Simulates the voice playing through a decent pair of headphones or earbuds." },
      { id: "large-home-entertainment-class-device", icon: "fad fa-speakers", name: "Home Theater", tooltip: "Simulates the voice playing through a premium home entertainment system." },
      { id: "small-bluetooth-speaker-class-device", icon: "fad fa-radio", name: "Mini Bluetooth® Speaker", tooltip: "Simulates the voice playing through a small-sized Bluetooth® speaker, such as a Google Nest Mini® or an Amazon Echo Pop™." },
      { id: "handset-class-device", icon: "fad fa-mobile-alt", name: "Phone Speaker", tooltip: "Simulates the voice playing through a smartphone speaker." },
      { id: "wearable-class-device", icon: "fad fa-watch-fitness", name: "Smart Watch", tooltip: "Simulates the voice playing through a wearable or smart watch device, like an Apple Watch® or a Google Pixel Watch™." },
      { id: "telephony-class-application", icon: "fad fa-phone-office", name: "Telephony", tooltip: "Simulates the voice being used in an interactive voice response system, like what a large call center would use to route inbound calls." },
    ];
    $scope.genders = [
      { id: "FEMALE", name: "Female" },
      { id: "MALE", name: "Male" },
      { id: "NEUTRAL", name: "Neutral" },
      { id: "SSML_VOICE_GENDER_UNSPECIFIED", name: "Unknown" },
    ];
    $scope.isApikeyConfigured = backendCommunicator.fireEventSync("gcpttsIsApikeyIntegrationConfigured") === true;
    $scope.isOauthConfigured = false; // backendCommunicator.fireEventSync("gcpttsIsOauthIntegrationConfigured") === true;
    $scope.voices = backendCommunicator.fireEventSync("gcpttsGetVoices") ?? [];

    // TODO: I NEED VOICES!!!

    $scope.areAnyEffectsCustomized = () => {
      return ($scope.effect.amplitudeAdjust !== $scope.defaultSettings.amplitudeAdjust)
      || ($scope.effect.effectProfiles.length > 0)
      || ($scope.effect.pitchAdjust !== $scope.defaultSettings.pitchAdjust)
      || ($scope.effect.speakingRate !== $scope.defaultSettings.speakingRate);
    };
    $scope.getApiName = (apiId) => {
      return $scope.apiVersions.find(api => api.id === apiId)?.name ?? "Unknown";
    };
    $scope.getEffectDescription = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)?.tooltip ?? "Unknown";
    };
    $scope.getEffectName = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)?.name ?? "Unknown";
    };
    $scope.getEffectIcon = (deviceProfileId) => {
      return $scope.deviceProfiles.find(dp => dp.id === deviceProfileId)?.icon ?? "fad fa-question-square";
    };
    $scope.getFormatTooltip = (fmtId) => {
      return $scope.audioFormats.find(fmt => fmt.id === fmtId)?.tooltip ?? "Unknown";
    };
    $scope.getFormatName = (fmtId) => {
      return $scope.audioFormats.find(fmt => fmt.id === fmtId)?.name ?? "Unknown";
    };
    $scope.getGenderName = (genderId) => {
      return $scope.genders.find(gender => gender.id === genderId)?.name ?? "Unknown";
    };
    $scope.openLink = (uri) => {
      $rootScope.openLinkExternally(uri);
    };
    $scope.resetAudioEffects = () => {
      $scope.effect.amplitudeAdjust = $scope.defaultSettings.amplitudeAdjust;
      $scope.effect.effectProfiles = $scope.defaultSettings.effectProfiles;
      $scope.effect.pitchAdjust = $scope.defaultSettings.pitchAdjust;
      $scope.effect.speakingRate = $scope.defaultSettings.speakingRate;

      $scope.effect.effectPitch = undefined; // MIGRATE
      $scope.effect.effectRate = undefined; // MIGRATE
      $scope.effect.effectVolume = undefined; // MIGRATE
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
          $scope.effect.stopOnError = false;
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
          $scope.effect.stopOnError = false;
        }
      }
    };

    $scope.effect ??= $scope.defaultSettings;
    $scope.effect.amplitudeAdjust ??= $scope.effect.effectVolume ?? $scope.defaultSettings.amplitudeAdjust; // MIGRATE
    $scope.effect.apiVersion ??= $scope.defaultSettings.apiVersion;
    $scope.effect.audioFormat ??= $scope.defaultSettings.audioFormat;
    $scope.effect.audioOutputDevice ??= $scope.defaultSettings.audioOutputDevice;
    $scope.effect.effectProfiles ??= $scope.defaultSettings.effectProfiles;
    $scope.effect.fallbackVoiceName ??= $scope.effect.variableVoice === true ? $scope.defaultSettings.fallbackVoiceName : undefined;
    $scope.effect.language ??= $scope.defaultSettings.language;
    $scope.effect.outputVolume ??= $scope.defaultSettings.outputVolume;
    // overlayInstance is untouchable
    $scope.effect.pitchAdjust ??= $scope.effect.effectPitch ?? $scope.defaultSettings.pitchAdjust; // MIGRATE
    $scope.effect.speakingRate ??= $scope.effect.effectRate ?? $scope.defaultSettings.speakingRate; // MIGRATE
    $scope.effect.ssml ??= $scope.defaultSettings.ssml;
    $scope.effect.stopOnError ??= $scope.defaultSettings.stopOnError;
    $scope.effect.text ??= $scope.defaultSettings.text;
    $scope.effect.variableVoice ??= $scope.defaultSettings.variableVoice;
    $scope.effect.voiceName ??= $scope.effect.voice ?? $scope.defaultSettings.voiceName; // MIGRATE
    $scope.effect.waitForPlayback = $scope.defaultSettings.waitForPlayback === true;

    $scope.effect.effectPitch = undefined; // MIGRATE
    $scope.effect.effectRate = undefined; // MIGRATE
    $scope.effect.effectVolume = undefined; // MIGRATE
    $scope.effect.voice = undefined; // MIGRATE

    $scope.fallbackVoiceEnabled = ($scope.effect.variableVoice === true && $scope.effect.fallbackVoiceName != null) === true;
    $scope.wantsBubbleStop = ($scope.effect.stopOnError === "bubble" || $scope.effect.stopOnError === "bubbleStop") === true;
    $scope.wantsStop = ($scope.effect.stopOnError === "stop" || $scope.effect.stopOnError === "bubbleStop") === true;
  },
  optionsValidator: (effect, $scope) => {
    const errors = [];
    if (effect == null) {
      errors.push("Something went wrong internally, as the effect is null");
      return errors;
    }

    if (!effect.text || effect.text.length < 1) {
      errors.push("Please input some text to speak aloud.");
    }
    if (effect.amplitudeAdjust === undefined || !Number.isFinite(effect.amplitudeAdjust) || effect.amplitudeAdjust < -96 || effect.amplitudeAdjust > 16) {
      errors.push("Amplitude adjustment is outside the acceptable range of -96 to 16");
    }
    if (effect.audioFormat === "MP3_64_KBPS" && effect.apiVersion !== "v1b1") {
      errors.push("MP3 64 kbps encoding is not available outside of the v1beta1 API");
    }
    if (effect.pitchAdjust === undefined || !Number.isFinite(effect.pitchAdjust) || effect.pitchAdjust < -20 || effect.pitchAdjust > 20) {
      errors.push("Pitch adjustment is outside the acceptable range of -20 to 20");
    }
    if (effect.speakingRate === undefined || !Number.isFinite(effect.speakingRate) || effect.speakingRate < 0.25 || effect.speakingRate > 4.0) {
      errors.push("Speaking rate effect is outside the acceptable range of 0.25 to 4");
    }
    if (!effect.voiceName || effect.voiceName.length < 4 && effect.variableVoice === true) {
      errors.push("Please select a voice to use.");
    }
    if (effect.variableVoice !== true && effect.voiceName && $scope.voices.length > 0 && !$scope.voices.some(voice => voice.name === effect.voiceName)) {
      errors.push(`Voice "${effect.voiceName}" is unknown`);
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
    const result = <EffectTriggerResult> {
      execution: {
        bubbleStop: event.effect.stopOnError === "bubble" || event.effect.stopOnError === "bubbleStop",
        stop: event.effect.stopOnError === "stop" || event.effect.stopOnError === "bubbleStop",
      },
      outputs: {
        ttsUsage: {
          billedUnits: 0,
          pricingBucket: null,
          voiceName: null,
          voiceType: null,
        },
      },
      success: false,
    };

    const { dataProvider, firebotSettings } = customPlugin;
    const { frontendCommunicator, path, resourceTokenManager } = customPlugin;

    // Migrate any old effects that haven't been saved since 0.3.
    effect.amplitudeAdjust ??= effect.effectVolume ?? 0.0; // MIGRATE
    effect.pitchAdjust ??= effect.effectPitch ?? 0.0; // MIGRATE
    effect.speakingRate ??= effect.effectRate ?? 1.0; // MIGRATE
    effect.voiceName ??= effect.voice ?? ""; // MIGRATE

    if (!effect.voiceName || !dataProvider.isKnownVoiceName(effect.voiceName)) {
      if (effect.variableVoice && effect.fallbackVoiceName && dataProvider.isKnownVoiceName(effect.fallbackVoiceName)) {
        effect.voiceName = effect.fallbackVoiceName;
        logger.warn(`Primary voice unavailable, falling back to "${effect.fallbackVoiceName}"`);
      } else {
        logger.error(`Unknown voice requested (${(effect.voiceName ?? "null")}), and the fallback voice was undefined or unknown`);
        return result;
      }
    }

    // tack on voice info, but continue assuming failure
    result.outputs.ttsUsage.voiceName = effect.voiceName;
    result.outputs.ttsUsage.voiceType = dataProvider.voiceType(effect.voiceName);


    ///////////////////////////////
    // Step 1: synthesize audio and write it to a file.
    ///////////////////////////////
    const audioFormat = audioFileExts.find(fmtDef => fmtDef.id === effect.audioFormat) || { id: "OGG_OPUS", ext: "ogg" };
    const filePath = path.join(dataProvider.audioFolderPath, `tts${uuid()}.${audioFormat.ext}`);
    try {
      const audioContent = await (effect.apiVersion === 'v1b1' ? google.textToSpeech.v1beta1 : google.textToSpeech.v1).text.synthesize(
        {
          ...(effect.ssml === true && { ssml: effect.text } || { text: effect.text }),
        },
        {
          languageCode: effect.language ?? dataProvider.voiceLocaleInfo(effect.voiceName ?? "")?.id ?? "",
          name: effect.voiceName,
        },
        {
          audioEncoding: audioFormat.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(effect.effectProfiles != null && effect.effectProfiles.length > 0 && { effectsProfileId: effect.effectProfiles as any }),
          ...(effect.effectPitch != null && effect.effectPitch !== 0 && { pitch: effect.effectPitch }),
          ...(effect.effectRate != null && effect.effectRate !== 1 && { speakingRate: effect.effectRate }),
          ...(effect.effectVolume != null && effect.effectVolume !== 0 && { volumeGainDb: effect.effectVolume }),
        },
      );
      if (audioContent == null || audioContent.length < 1) {
        logger.warn(`Got no response data from ${effect.apiVersion}/text/synthesize`);
        return result;
      }

      // It has now been billed out, but there's still plenty of failure opportunities... tack on billing info.
      // Standard and Wavenet both bill per character, others bill per byte: https://cloud.google.com/text-to-speech/pricing;
      result.outputs.ttsUsage.billedUnits = dataProvider.voiceType(effect.voiceName) === "Standard" || dataProvider.voiceType(effect.voiceName) === "Wavenet" ? effect.text.length : new Blob([effect.text]).size;
      result.outputs.ttsUsage.pricingBucket = dataProvider.voicePricing(effect.voiceName);

      await fsp.writeFile(filePath, Buffer.from(audioContent, 'base64'), { encoding: "binary", flush: true, mode: 0o644 });
      const fileStats = await fsp.stat(filePath);
      logger.debug(`wrote audio file to ${filePath} of size ${fileStats.size}`);
    } catch (err) {
      logger.errorEx("Failed to synthesize audio or write it to file", err as Error, err as Error);
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
      logger.warnEx("Failed to determine audio file duration, going to blindly assume 30 seconds", err as Error);
    }
    if (durationInSeconds <= 0) {
      durationInSeconds = 30;
    }
    const durationInMils = Math.round(durationInSeconds + 0.5) * 1000;


    ///////////////////////////////
    // Step 3: play the audio file
    ///////////////////////////////
    try {
      const soundData: OverlayData = {
        audioOutputDevice: (effect.audioOutputDevice && effect.audioOutputDevice.label !== "App Default")
          ? effect.audioOutputDevice
          : firebotSettings.getAudioOutputDevice(),
        filepath: filePath,
        format: audioFormat.ext,
        maxSoundLength: durationInSeconds,
        volume: effect.outputVolume ?? 5,
      };

      if (soundData.audioOutputDevice.deviceId === "overlay") {
        soundData.resourceToken = resourceTokenManager.storeResourcePath(soundData.filepath, durationInSeconds);

        if (firebotSettings.useOverlayInstances() && effect.overlayInstance && firebotSettings.getOverlayInstances().includes(effect.overlayInstance)) {
          soundData.overlayInstance = effect.overlayInstance;
        }

        event.sendDataToOverlay(soundData, soundData.overlayInstance);
        //httpServer.sendToOverlay("sound", soundData as any);
        logger.debug("sent soundData to overlay");
      } else {
        frontendCommunicator.send("playsound", soundData);
        logger.debug("sent soundData to playsound");
      }
    } catch (err) {
      logger.errorEx("Error submitting audio for playback", err as Error, err as Error);
      try {
        await fsp.unlink(filePath);
      } catch {
      }
      return result;
    }


    // Primary objectives are all complete, even if everything remaining goes haywire.
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
          logger.debug(`Deleted sync audio file "${filePath}" as it has been completed`);
        } catch (err) {
          logger.warnEx(`Failed to remove audio file after synchronous play; "${filePath}" can be manually deleted at your leisure`, err as Error, err as Error);
        }
      });
    } else {
      // Fire and forget.
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted async audio file "${filePath}" as it has been completed`);
        } catch (err) {
          logger.warnEx(`Failed to remove audio file after asynchronous play; "${filePath}" can be manually deleted at your leisure`, err as Error);
        }
      }, durationInMils + 1000);
    }

    ///////////////////////////////
    // Step 5: **profit**
    ///////////////////////////////
    logger.debug(`Finished synthesizing ${effect.text.length} characters using ${effect.voiceName}.`);
    return result;
  },
};

export default synthesizeEffect;
