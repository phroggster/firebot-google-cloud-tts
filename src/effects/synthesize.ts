import { Effects, EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { v4 as uuid } from "uuid";
import fs from "fs";
import fsp from "fs/promises";

import consts from "../consts";
import { ContextLogger } from "../context-logger";
import gcp from "../google-cloud-api";
import { dataProvider, folders, modules, settings } from "../main";
import { EAudioEncoding, EAudioProfile, IDataProvider, VoiceInfo } from "../types";
import { wait } from "../utils";

enum EApiVersion {
  unknown = "unknown",
  v1 = "v1",
  v1b1 = "v1b1",
};

/** The data model that will be used with this effect. */
interface EffectModel {
  /** The input text or SSML to synthesize. */
  text: string;
  /** The name of the voice to use to synthesize the speech. */
  voice: string;
  /** The BCP-47 language and optional region code to use. When undefined or null, the language will be inferred from voiceName. */
  language: string;

  /** The pitch adjustment to use. Default: 0.0. */
  effectPitch: number;
  /** An array of available speech synthesis effect profiles used to simulate listening on various audio devices. Default: []. Multiple effects can be combined, but leave empty for the best quality. */
  effectProfiles: EAudioProfile[];
  /** The speaking rate to use. Default: 1.0. */
  effectRate: number;
  /** Adjust the apparant amplitude gain of the voice. Default: 0.0. */
  effectVolume: number;

  /** The audio output device to speak the text out with: e.g. "App Default", "overlay", "Headphones", "Speakers", etc. */
  audioOutputDevice: {
    deviceId?: string;
    label?: string;
  };
  /** The volume to play the resulting sample at. Default 5.0, range 1.0 to 10.0. */
  outputVolume: number;
  /** Used to specify which overlay instance to send audio to when overlay instancing has been enabled. */
  overlayInstance?: string;

  /** The audio format specifier to use. Default: oggopus */
  audioFormat: EAudioEncoding;
  /** The text-to-speech api revision to use. Default: v1. Acceptable values: v1, v1b1. */
  apiVersion: EApiVersion;
  /** Enable SSML formatting in the provided text. Default: false. */
  ssml: boolean;
  /** Whether to wait for playback to finish before marking the effect as completed. Default: true. */
  waitForPlayback: boolean;
};

/** The data model that Firebot uses to play sound data, either via playsound or sendDataToOverlay. */
interface SoundDataModel {
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

type OnInit = {
  /** Automatically invoked during initialization after the data model has been hydrated. */
  $onInit(): void;
};

/** All of the stuff that is needed to display the effect's templated control. */
interface Scope extends EffectScope<EffectModel>, OnInit {
  /** All of the voices that are available for use. */
  allVoices: VoiceInfo[];

  /** The plugin data and settings de/serialization service. */
  dataProvider?: IDataProvider;


  /** A read-only object representing the default effect settings. */
  defaultSettings: EffectModel;

  ///** An array of all genders available for filtering voices, i.e. [ "Any", "Male", "Female" ] */
  //selectableGenders: Array<string>;
  ///** An array of all languages available for filtering voices, e.g. [ "Any", "English (United States)", ... ]. */
  //selectableLanguages: Array<string>;
  ///** An array of all pricing tiers available for filtering voices, i.e. [ "Any", "Standard", "Premium', "Studio" ]. */
  //selectablePricingTiers: Array<string>;
  ///** An array of all synthesis technologies available for filtering voices, e.g. [ "Any", "Standard", "Wavenet", "Neural2", ...]. */
  //selectableTechnologies: Array<string>;
  //
  ///** A boolean value indicating whether the filters pane is hidden. */
  //isFiltersCollapsed: boolean;
  //filters?: {
  //    gender?: string;
  //    language?: string;
  //    name?: string;
  //    pricing?: string;
  //    technology?: string;
  //};
  //filterByGender(voiceList: Array<VoiceInfo>, gender: string): Array<VoiceInfo>;
  //filterByLang(voiceList: Array<VoiceInfo>, langCode: string): Array<VoiceInfo>;
  //filterByPricing(voiceList: Array<VoiceInfo>, priceTier: string): Array<VoiceInfo>;
  //filterByTech(voiceList: Array<VoiceInfo>, tech: string): Array<VoiceInfo>;

  /** Returns the BCP-47 language code that a voice utilizes.
   * @param voiceInfo An object representing a voice available for text-to-speech synthesis.
   */
  getLangCode(voiceInfo: VoiceInfo): string;

  /** Returns the technology that a voice utilizes.
   * @param voiceInfo An object representing a voice available for text-to-speech synthesis.
   */
  getVoiceTech(voiceInfo: VoiceInfo): string;

  /** Returns a value indicating if any audio effects will be applied to the TTS synthesis. */
  isGeneratorCustomized(): boolean;

  /**
   * Open a URL in an external web browser.
   * @param uri The URI to open.
   */
  openLink(uri: string): void;

  /** Resets any generator audio effects to defaults. Has no effect if isGeneratorCustomized returns false. */
  resetGeneratorSettings(): void;
};

type RootScope = {
  openLinkExternally(uri: string): void;
};

const audioFormats = [
  { description: "MP3 64k (v1beta1 only)", fileExtension: "mp3", id: "MP3_64_KBPS" },
  { description: "Ogg Opus", fileExtension: "ogg", id: "OGG_OPUS" },
  { description: "MP3 32k", fileExtension: "mp3", id: "MP3" },
  { description: "Uncompressed WAV", fileExtension: "wav", id: "LINEAR16" },
  { description: "European phone (A-law)", fileExtension: "wav", id: "ALAW" },
  { description: "America/Japan phone (μ-law)", fileExtension: "wav", id: "MULAW" },
];
const effectProfiles = [
  "wearable-class-device",
  "handset-class-device",
  "headphone-class-device",
  "small-bluetooth-speaker-class-device",
  "medium-bluetooth-speaker-class-device",
  "large-home-entertainment-class-device",
  "large-automotive-class-device",
  "telephony-class-application",
];
const logger = new ContextLogger("effects.synthesize");

const synthesizeEffect: Effects.EffectType<EffectModel, SoundDataModel> = {
  definition: {
    id: consts.TTS_EFFECT_ID,
    name: "Text-To-Speech (Google Cloud)",
    description: "Synthesize some speech using Google Cloud TTS (revised).",
    icon: "fad fa-microphone-alt",
    categories: ["fun"],
    dependencies: [],
  },
  optionsTemplate: `
            <eos-container header="Text">
                <textarea ng-model="effect.text" class="form-control" name="text" placeholder="Enter text" rows="4" cols="40" replace-variables menu-position="under"></textarea>
            </eos-container>

            <eos-container header="Voice" pad-top="true">
                <a ng-click="openLink('https://cloud.google.com/text-to-speech/docs/voices')" class="clickable"
                    uib-tooltip="Open page with voice details and samples in a web browser"
                    aria-label="Open detailed list of voices with samples in a web browser">Voices list with samples</a>
                <ui-select ng-model="effect.voice" theme="bootstrap">
                    <ui-select-match placeholder="Select or search for a voice...">{{$select.selected.name}}</ui-select-match>
                    <ui-select-choices repeat="voiceInfo.name as voiceInfo in allVoices | filter: { name: $select.search }" style="position:relative;">
                        <div ng-bind-html="voiceInfo.name | highlight: $select.search"></div>
                        <small class="muted"><strong>Pricing: {{dataProvider.getVoicePricingTier(voiceInfo.name)}} | Tech: {{dataProvider.getVoiceTechnology(voiceInfo.name)}} | {{voiceInfo.language}} | {{voiceInfo.gender}}</small>
                    </ui-select-choices>
                </ui-select>

                <!--
                <button type="button" class="btn btn-default dropdown-toggle" ng-click="isFiltersCollapsed = !isFiltersCollapsed" aria-haspopup="true" pad-top="true">Filters</button>
                <div ng-if="!isFiltersCollapsed" uib-collapse="isFiltersCollapsed" aria-expanded="!isFiltersCollapsed">
                    <div class="effect-setting-container">
                        <h4>Gender</h4>
                        <ui-select ng-model="filters.gender" theme="bootstrap">
                            <ui-select-match placeholder="Filter by Gender">{{$select.selected}}</ui-select-match>
                            <ui-select-choices repeat="gender in selectableGenders">
                                <div ng-bind-html="gender | highlight: $select.search"></div>
                            </ui-select-choices>
                        </ui-select>
                    </div>
                    <div class="effect-setting-container">
                        <h4>Language</h4>
                        <ui-select header="Language" ng-model="filter.language" theme="bootstrap">
                            <ui-select-match placeholder="Filter by Language">{{$select.selected}}</ui-select-match>
                            <ui-select-choices repeat="language in selectableLanguages">
                                <div ng-bind-html="language | highlight: $select.search"></div>
                            </ui-select-choices>
                        </ui-select>
                    </div>
                    <div class="effect-setting-container">
                        <h4>Pricing</h4>
                        <ui-select header="Pricing" ng-model="filter.pricing" theme="bootstrap">
                            <ui-select-match placeholder="Filter by pricing">{{$filters.pricing}}</ui-select-match>
                            <ui-select-choices repeat="pricingTier in selectablePricingTiers">
                                <div ng-bind-html="pricingTier"></div>
                            </ui-select-choices>
                        </ui-select>
                    </div>
                    <div class="effect-setting-container">
                        <h4>Technology</h4>
                        <ui-select header="Technology" ng-model="filter.technology" theme="bootstrap">
                            <ui-select-match placeholder="Filter by technology">{{$filters.technology}}</ui-select-match>
                            <ui-select-choices repeat="technology in selectableTechnologies">
                                <div ng-bind-html="technology"></div>
                            </ui-select-choices>
                        </ui-select>
                    </div>
                </div>
                --!>
            </eos-container>

            <!--
            <eos-container header="Generator Effects" pad-top="true">
                <div uib-tooltip="Pitch effects are not usable with Journey voices" aria-label="Pitch effects are not usable with Journey voices">
                    <h4>Pitch</h4>
                    <div class="volume-slider-wrapper">
                        <i class="fal fa-chevron-double-down"></i>
                        <rzslider rz-slider-model="effect.effectPitch" rz-slider-options="{floor: -20.0, ceil: 20.0, precision: 1, step: 0.05}"></rzslider>
                        <i class="fal fa-chevron-double-up"></i>
                    </div>
                </div>
                <div uib-tooltip="Rate effects are not usable with Journey voices" aria-label="Rate effects are not usable with Journey voices">>
                    <h4>Rate</h4>
                    <div class="volume-slider-wrapper">
                        <i class="fal fa-backward"></i>
                        <rzslider rz-slider-model="effect.effectRate" rz-slider-options="{floor: -0.25, ceil: 4, precision: 2, step: 0.05}"></rzslider>
                        <i class="fal fa-forward"></i>
                    </div>
                </div>
                <div>
                    <h4>Volume</h4>
                    <div class="volume-slider-wrapper">
                        <i class="fal fa-volume-down volume-low"></i>
                        <rzslider rz-slider-model="effect.effectVolume" rz-slider-options="{floor: -96, ceil: 16, precision: 1, step: 0.05}"></rzslider>
                        <i class="fal fa-volume-up volume-high"></i>
                    </div>
                </div>
                <div uib-collapse="!isGeneratorCustomized()" aria-expanded="!isGeneratorCustomized()">
                    <button class="btn btn-default" ng-click="resetGeneratorSettings()">Reset to Defaults</button>
                </div>
            </eos-container>
            --!>

            <eos-container header="Output Settings" pad-top="true">
                <eos-audio-output-device effect="effect"></eos-audio-output-device>
                <eos-overlay-instance ng-if="effect.audioOutputDevice && effect.audioOutputDevice.deviceId === 'overlay'" effect="effect" pad-top="true"></eos-overlay-instance>
                <eos-container header="Volume">
                    <div class="volume-slider-wrapper">
                        <i class="fal fa-volume-down volume-low"></i>
                        <rzslider rz-slider-model="effect.outputVolume" rz-slider-options="{floor: 1, ceil: 10, precision: 1, step: 0.1}"></rzslider>
                        <i class="fal fa-volume-up volume-high"></i>
                    </div>
                </eos-container>
            </eos-container>
        `,
  optionsController: ($ctrl: unknown, $rootScope: unknown, $scope: unknown) => {
    const scope = $scope as Scope;
    if (scope === null || scope === undefined) {
      throw new Error("$scope parameter not assignable to a Scope");
    }

    scope.dataProvider = dataProvider ?? undefined;
    if (scope.dataProvider === undefined) {
      throw new Error("$scope data provider undefined");
    }

    scope.allVoices = dataProvider?.getAllVoicesSync() ?? [];
    scope.defaultSettings = Object.freeze<EffectModel>({
      text: "",
      voice: "en-US-Neural2-C",
      language: "en-US",

      effectPitch: 0.0,
      effectProfiles: [],
      effectRate: 1.0,
      effectVolume: 0.0,

      audioOutputDevice: { label: "App Default" },
      outputVolume: 7.0,
      // overlayInstance: undefined,
      audioFormat: EAudioEncoding.oggopus,

      apiVersion: EApiVersion.v1,
      ssml: false,
      waitForPlayback: true,
    });
    scope.openLink ??= ($rootScope as RootScope)?.openLinkExternally;

    scope.getLangCode = (voiceInfo: VoiceInfo): string => {
      if ((voiceInfo?.name?.length ?? 0) < 1) {
        return "Unknown";
      }
      const endIdx = voiceInfo.name.lastIndexOf("-");
      const withLastHyphen = voiceInfo.name.substring(0, endIdx);
      const startIdx = withLastHyphen.lastIndexOf("-");
      return voiceInfo.name.substring(0, startIdx);
    };
    scope.getPricingTier = (voiceInfo: VoiceInfo): string => {
      if ((voiceInfo?.name?.length ?? 0) > 4) {
        if (voiceInfo.name.includes("Standard")) {
          return "Standard";
        }
        if (voiceInfo.name.includes("Journey")) {
          return "Journey";
        }
        if (voiceInfo.name.includes("Studio")) {
          return "Studio";
        }
        for (const tier of ["Casual", /*"Journey",*/ "Neural2", "News", "Polyglot", "Wavenet"]) {
          if (voiceInfo.name.includes(tier)) {
            return "Premium";
          }
        }
      }
      return "Unknown";
    };
    scope.getVoiceTech = (voiceInfo: VoiceInfo): string => {
      if ((voiceInfo?.name?.length ?? 0) < 4) {
        return "Unknown";
      }
      const { name } = voiceInfo;
      const endIdx = name.lastIndexOf("-");
      const withoutLastHyphen = name.substring(0, endIdx);
      const startIdx = withoutLastHyphen.lastIndexOf("-");
      return withoutLastHyphen.substring(startIdx + 1, endIdx);
    };

    scope.isGeneratorCustomized = (): boolean => {
      return !(
        scope.effect.effectPitch === scope.defaultSettings.effectPitch &&
        scope.effect.effectProfiles === scope.defaultSettings.effectProfiles &&
        scope.effect.effectRate === scope.defaultSettings.effectRate &&
        scope.effect.effectVolume === scope.defaultSettings.effectVolume);
    };
    scope.resetGeneratorSettings = (): void => {
      scope.effect.effectPitch = scope.defaultSettings.effectPitch;
      scope.effect.effectProfiles = scope.defaultSettings.effectProfiles;
      scope.effect.effectRate = scope.defaultSettings.effectRate;
      scope.effect.effectVolume = scope.defaultSettings.effectVolume;
    };

    ($ctrl as OnInit).$onInit = () => {
      logger.debug(`Ctrl oninit, scope effect is: "${scope.effect}"`);
      if (!scope.effect) {
        scope.effect = scope.defaultSettings;
      }
    };
    scope.$onInit = () => {
      logger.debug(`Scope oninit, scope effect is: "${scope.effect}"`);
    };
    //$scope.$onInit = () => {
    //  if (!$scope.effect) {
    //    $scope.effect = $scope.defaultSettings;
    //  }
    //  if (!$scope.effect.text) {
    //    $scope.effect.text = $scope.defaultSettings.text;
    //  }
    //  if (!$scope.effect.voice) {
    //    $scope.effect.voice = $scope.defaultSettings.voice;
    //  }
    //  if (!$scope.effect.language) {
    //    $scope.effect.language = $scope.dataProvider.getVoiceLanguageSync($scope.effect.voice).id;
    //  }
    //  if ($scope.effect.effectPitch == null || !Number.isFinite($scope.effect.effectPitch) || $scope.effect.effectPitch < -20.0 || $scope.effect.effectPitch > 20.0) {
    //    $scope.effect.effectPitch = $scope.defaultSettings.effectPitch;
    //  }
    //  if ($scope.effect.effectProfiles == null || $scope.effect.effectProfiles.some(ep => !Object.values(EAudioProfile).includes(ep))) {
    //    $scope.effect.effectProfiles = $scope.defaultSettings.effectProfiles;
    //  }
    //  if ($scope.effect.effectRate == null || !Number.isFinite($scope.effect.effectRate) || $scope.effect.effectRate < 0.25 || $scope.effect.effectRate > 4.0) {
    //    $scope.effect.effectRate = $scope.defaultSettings.effectRate;
    //  }
    //  if ($scope.effect.effectVolume == null || !Number.isFinite($scope.effect.effectVolume) || $scope.effect.effectVolume < -96.0 || $scope.effect.effectVolume > 16.0) {
    //    $scope.effect.effectVolume = $scope.defaultSettings.effectVolume;
    //  }
    //  if ($scope.effect.outputVolume == null || !Number.isFinite($scope.effect.outputVolume) || $scope.effect.outputVolume < 1 || $scope.effect.outputVolume > 10) {
    //    $scope.effect.outputVolume = $scope.defaultSettings.outputVolume;
    //  }
    //  if ($scope.effect.audioFormat == null || $scope.effect.audioFormat === EAudioEncoding.unspecified) {
    //    $scope.effect.audioFormat = EAudioEncoding.oggopus;
    //  }
    //  if ($scope.effect.apiVersion == null || $scope.effect.apiVersion === EApiVersion.unknown) {
    //    $scope.effect.apiVersion = EApiVersion.v1;
    //  }
    //  if ($scope.effect.ssml === null || $scope.effect.ssml === undefined) {
    //    $scope.effect.ssml = $scope.defaultSettings.ssml;
    //  } else {
    //    const lstring = `${$scope.effect.ssml}`.toLowerCase();
    //    if (lstring === "false") {
    //      $scope.effect.ssml = false;
    //    } else if (lstring === "true") {
    //      $scope.effect.ssml = true;
    //    } else {
    //      $scope.effect.ssml = $scope.defaultSettings.ssml;
    //    }
    //  }
    //  if ($scope.effect.waitForPlayback === null || $scope.effect.waitForPlayback === undefined) {
    //    $scope.effect.waitForPlayback = $scope.defaultSettings.waitForPlayback;
    //  } else {
    //    const lString = `${$scope.effect.waitForPlayback}`.toLowerCase();
    //    if (lString === "false") {
    //      $scope.effect.waitForPlayback = false;
    //    } else if (lString === "true") {
    //      $scope.effect.waitForPlayback = true;
    //    } else {
    //      $scope.effect.waitForPlayback = $scope.defaultSettings.waitForPlayback;
    //    }
    //  }
    //};
    if (!scope.effect) {
      scope.effect = scope.defaultSettings;
    }
    if (!scope.effect.text) {
      scope.effect.text = scope.defaultSettings.text;
    }
    if (!scope.effect.voice) {
      scope.effect.voice = scope.defaultSettings.voice;
    }
    if (!scope.effect.language) {
      scope.effect.language = scope.dataProvider.getVoiceLanguageSync(scope.effect.voice)?.id ?? scope.defaultSettings.language;
    }
    if (scope.effect.effectPitch == null || !Number.isFinite(scope.effect.effectPitch) || scope.effect.effectPitch < -20.0 || scope.effect.effectPitch > 20.0) {
      scope.effect.effectPitch = scope.defaultSettings.effectPitch;
    }
    if (scope.effect.effectProfiles == null || scope.effect.effectProfiles.some(ep => !Object.values(EAudioProfile).includes(ep))) {
      scope.effect.effectProfiles = scope.defaultSettings.effectProfiles;
    }
    if (scope.effect.effectRate == null || !Number.isFinite(scope.effect.effectRate) || scope.effect.effectRate < 0.25 || scope.effect.effectRate > 4.0) {
      scope.effect.effectRate = scope.defaultSettings.effectRate;
    }
    if (scope.effect.effectVolume == null || !Number.isFinite(scope.effect.effectVolume) || scope.effect.effectVolume < -96.0 || scope.effect.effectVolume > 16.0) {
      scope.effect.effectVolume = scope.defaultSettings.effectVolume;
    }
    if (scope.effect.outputVolume == null || !Number.isFinite(scope.effect.outputVolume) || scope.effect.outputVolume < 1 || scope.effect.outputVolume > 10) {
      scope.effect.outputVolume = scope.defaultSettings.outputVolume;
    }
    if (scope.effect.audioFormat == null || scope.effect.audioFormat === EAudioEncoding.unspecified) {
      scope.effect.audioFormat = EAudioEncoding.oggopus;
    }
    if (scope.effect.apiVersion == null || scope.effect.apiVersion === EApiVersion.unknown) {
      scope.effect.apiVersion = EApiVersion.v1;
    }
    if (scope.effect.ssml === null || scope.effect.ssml === undefined) {
      scope.effect.ssml = scope.defaultSettings.ssml;
    } else {
      const lstring = `${scope.effect.ssml}`.toLowerCase();
      if (lstring === "false") {
        scope.effect.ssml = false;
      } else if (lstring === "true") {
        scope.effect.ssml = true;
      } else {
        scope.effect.ssml = scope.defaultSettings.ssml;
      }
    }
    if (scope.effect.waitForPlayback === null || scope.effect.waitForPlayback === undefined) {
      scope.effect.waitForPlayback = scope.defaultSettings.waitForPlayback;
    } else {
      const lString = `${scope.effect.waitForPlayback}`.toLowerCase();
      if (lString === "false") {
        scope.effect.waitForPlayback = false;
      } else if (lString === "true") {
        scope.effect.waitForPlayback = true;
      } else {
        scope.effect.waitForPlayback = scope.defaultSettings.waitForPlayback;
      }
    }
  },
  optionsValidator: (effect) => {
    const errors = [];
    if (effect === null) {
      errors.push("Something went wrong internally, as the effect is null");
      return errors;
    }

    if (effect.text.length < 1) {
      errors.push("Please input some text to speak aloud.");
    }
    if (effect.voice.length < 4) {
      errors.push("Please select a voice to use.");
    }
    if (effect.audioFormat === EAudioEncoding.mp364 && effect.apiVersion !== EApiVersion.v1b1) {
      errors.push("MP3 64kbps encoding is not available without using the v1beta1 API");
    }
    if (effect.effectPitch && (!Number.isFinite(effect.effectPitch) || effect.effectPitch < -20 || effect.effectPitch > 20)) {
      errors.push("Pitch effect is outside the acceptable range of -20 to 20");
    }
    if (effect.effectRate && (!Number.isFinite(effect.effectRate) || effect.effectRate < 0.25 || effect.effectRate > 4.0)) {
      errors.push("Speaking rate effect is outside the acceptable range of 0.25 to 4");
    }
    if (effect.effectVolume && (!Number.isFinite(effect.effectVolume) || effect.effectVolume < -96 || effect.effectVolume > 16)) {
      errors.push("Amplitude effect is outside the acceptable range of -96 to 16");
    }

    // TODO: verify audioEncoding
    return errors;
  },
  onTriggerEvent: async (event) => {
    if (!folders || !modules || !settings) {
      throw new Error("Plugin appears to have been unloaded, cannot continue");
    }
    const { effect, sendDataToOverlay, trigger } = event;
    const { frontendCommunicator, httpServer, path, resourceTokenManager } = modules;
    const { tmpDir } = folders;
    const audioFormat = effect.audioFormat == null || effect.audioFormat === EAudioEncoding.unspecified ? EAudioEncoding.oggopus : effect.audioFormat;

    // Step 1: synthesize audio and write it to a file.
    const fileExt = audioFormats.find(af => af.id === audioFormat)?.fileExtension || "ogg";
    const filePath = path.join(tmpDir, `tts${uuid()}.${fileExt}`);
    try {
      const api = effect.apiVersion === 'v1b1' ? gcp.textToSpeech.v1beta1 : gcp.textToSpeech.v1;
      const synthInput = effect.ssml === true ? { ssml: effect.text } : { text: effect.text };
      const audioContent = await api.text.synthesize(synthInput,
        {
          languageCode: effect.language,
          name: effect.voice,
        },
        {
          audioEncoding: audioFormat,
          effectsProfileId: effect.effectProfiles != null && effect.effectProfiles.length > 0 ? effect.effectProfiles : undefined,
          pitch: effect.effectPitch !== null ? effect.effectPitch : undefined,
          speakingRate: effect.effectRate !== null ? effect.effectRate : undefined,
          volumeGainDb: effect.effectVolume !== null ? effect.effectVolume : undefined,
        });
      if (audioContent == null || audioContent.length < 1) {
        logger.warn("Received null from synthesizeText");
        return true;
      }

      await fsp.writeFile(filePath, Buffer.from(audioContent, 'base64'), { encoding: "binary", flush: true, mode: 0o644 });
      logger.debug(`wrote audio file to ${filePath}`);
    } catch (err) {
      logger.exception("Error synthesizing audio or writing it to file", err as Error);
      return true;
    }

    // Step 2: determine the audio file's playback length
    let durationInSeconds = 30;
    try {
      // get the duration of this sound file
      durationInSeconds = await frontendCommunicator.fireEventAsync<number>(
        "getSoundDuration", { format: fileExt, path: filePath },
      );
    } catch (err) {
      logger.exception("Error determining audio file duration", err as Error);
      try {
        await fsp.unlink(filePath);
      } catch {
      }
      return true;
    }
    const durationInMils = (Math.round(durationInSeconds) || 1) * 1000;

    // Step 3: play it
    try {
      const soundData: SoundDataModel = {
        audioOutputDevice: (effect.audioOutputDevice?.label && effect.audioOutputDevice.label !== "App Default")
          ? effect.audioOutputDevice
          : settings.getAudioOutputDevice(),
        filepath: filePath,
        format: "mp3",
        maxSoundLength: durationInSeconds,
        volume: effect.outputVolume ?? 5.0,
      };

      // actually play the TTS audio
      if (soundData.audioOutputDevice.deviceId === "overlay") {
        soundData.resourceToken = resourceTokenManager.storeResourcePath(soundData.filepath, durationInSeconds);

        if (settings.useOverlayInstances() && effect.overlayInstance !== null && settings.getOverlayInstances().includes(effect.overlayInstance)) {
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
      logger.error("Error submitting audio for playback", err);
      try {
        await fsp.unlink(filePath);
      } catch {
      }
      return true;
    }

    // Step 4: remove the audio file after it's done playing
    if (effect.waitForPlayback !== false) {
      // Wait for it to finish playing, then delete it.
      await wait(durationInMils).then(async function () {
        try {
          await fsp.unlink(filePath);
          logger.debug(`Deleted sync audio file "${filePath}" as it has been completed`);
        } catch (err) {
          logger.exception(`Failed to remove audio file after synchronous play; "${filePath}" can be manually deleted at your leisure"`, err as Error);
        }
      });
    } else {
      // Fire and forget.
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted async audio file "${filePath}" as it has been completed`);
        } catch (err) {
          logger.exception(`Failed to remove audio file after asynchronous play; "${filePath}" can be manually deleted at your leisure"`, err as Error);
        }
      }, durationInMils + 1000);
    }

    // returning true tells the firebot effect system this effect has completed and that it can continue to the next effect
    logger.debug(`Finished synthesizing ${effect.text.length} characters with ${effect.voice}.`);
    return true;
  },
};

export default synthesizeEffect;
