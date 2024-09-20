import { Effects, EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { v4 as uuid } from "uuid";
import fs from "fs";
import fsp from "fs/promises";

import consts from "../consts";
import { ContextLogger } from "../context-logger";
import gcp from "../google-cloud-api";
import { dataProvider, folders, modules, settings } from "../main";
import { EAudioEncoding, EAudioProfile, ExtendedVoiceInfo, VoiceInfo } from "../types";
import { wait } from "../utils";

type ApiDefinition = {
  id: string;
  name: string;
};
type AudioEffectDefinition = {
  description: string;
  id: string; // EAudioProfile;
  name: string;
};
type AudioFormatDefinition = {
  description: string;
  id: string; // EAudioEncoding;
  fileExtension: string;
};

/** The data model that will be used with this effect. */
interface IEffectModel {
  /** The input text or SSML to synthesize. */
  text: string;
  /** The name of the voice to use to synthesize the speech. */
  voice: string;
  /** The BCP-47 language and optional region code to use. When undefined or null, the language will be inferred from voiceName. */
  language?: string;

  /** The pitch adjustment to use. Default: 0.0. */
  effectPitch?: number;
  /** An array of available speech synthesis effect profiles used to simulate listening on various audio devices. Default: []. Multiple effects can be combined, but leave empty for the best quality. */
  effectProfiles?: string[];
  /** The speaking rate to use. Default: 1.0. */
  effectRate?: number;
  /** Adjust the apparent amplitude gain of the voice. Default: 0.0. */
  effectVolume?: number;

  /** The audio output device to speak the text out with: e.g. "App Default", "overlay", "Headphones", "Speakers", etc. */
  audioOutputDevice?: {
    deviceId?: string;
    label?: string;
  };
  /** The volume to play the resulting sample at. Default 5.0, range 1.0 to 10.0. */
  outputVolume?: number;
  /** Used to specify which overlay instance to send audio to when overlay instancing has been enabled. */
  overlayInstance?: string;

  /** The audio format specifier to use. Default: oggopus */
  audioFormat?: string;
  /** The text-to-speech api revision to use. Default: v1. Acceptable values: v1, v1b1. */
  apiVersion?: string;
  /** Enable SSML formatting in the provided text. Default: false. */
  ssml?: boolean;
  /** Whether to wait for playback to finish before marking the effect as completed. Default: true. */
  waitForPlayback?: boolean;
};

/** An object that has an $onInit() function. */
interface IOnInitable {
  /** Automatically invoked during initialization after the data model has been hydrated. */
  $onInit(): void;
};

interface ICtrl extends IOnInitable {
  /** The Google Cloud Platform text-to-speech API versions that are available for use. */
  apiDefinitions: ApiDefinition[];
  /** An object representing the default effect model settings. */
  defaultSettings: IEffectModel;
  /** All of the audio effects that are available for use. */
  effectDefinitions: AudioEffectDefinition[];
  /** All of the audio file formats that are available for use. */
  formatDefinitions: AudioFormatDefinition[];
  /** All of the voices that are available for use. */
  voices: ExtendedVoiceInfo[];
}

/** The angular root scope. */
interface IRootScope {
  openLinkExternally(uri: string): void;
};

/** The angular control's scope. */
interface IScope extends EffectScope<IEffectModel>, IOnInitable {
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

/** The data model that Firebot uses to play sound data, either via playsound or sendDataToOverlay. */
interface ISoundDataModel {
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

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
declare function clone<T>(val: T): Mutable<T>;

const defaultSettings = Object.freeze<IEffectModel>({
  apiVersion: "v1",
  audioFormat: "OGG_OPUS", // EAudioEncoding.oggopus
  audioOutputDevice: { label: "App Default" },
  effectPitch: 0.0,
  effectProfiles: [],
  effectRate: 1.0,
  effectVolume: 0.0,
  language: "en-US",
  outputVolume: 7,
  overlayInstance: undefined,
  ssml: false,
  text: "",
  voice: "en-US-Neural2-C",
  waitForPlayback: true,
});
const apiDefinitions = Object.freeze<ApiDefinition[]>([
  { id: "v1", name: "Version 1" },
  { id: "v1b1", name: "Version 1 beta 1" },
]);
const effectDefinitions = Object.freeze<AudioEffectDefinition[]>([
  { name: "Bluetooth® Speaker", id: EAudioProfile.medbt, description: "Simulates the audio playing through a larger Bluetooth® speaker, such as an Amazon Echo Studio® or a Google Nest Audio® device." },
  { name: "Car Stereo", id: EAudioProfile.auto, description: "Simulates the audio playing through a high-end car stereo system." },
  { name: "Headphones", id: EAudioProfile.headphone, description: "Simulates the audio playing through a decent pair of headphones or earbuds." },
  { name: "Home Theater", id: EAudioProfile.homeent, description: "Simulates the audio playing through a high-end home entertainment system." },
  { name: "Mini Bluetooth® Speaker", id: EAudioProfile.smallbt, description: "Simulates the audio playing through a small-sized Bluetooth® speaker, like as Amazon Echo Pop™ or a Google Nest Mini®." },
  { name: "Phone Speaker", id: EAudioProfile.handset, description: "Simulates the audio playing through a smartphone speaker." },
  { name: "Smart Watch", id: EAudioProfile.wearable, description: "Simulates the audio playing through a smart watch, like an Apple Watch® or a Google Pixel Watch™." },
  { name: "Telephony", id: EAudioProfile.telephony, description: "Simulates the audio being used in an interactive voice response system, like what a large call center would use for inbound calls." },
]);
const formatDefinitions = Object.freeze<AudioFormatDefinition[]>([
  { description: "MP3 64k (v1beta1 only)", fileExtension: "mp3", id: EAudioEncoding.mp364 },
  { description: "Ogg Opus", fileExtension: "ogg", id: EAudioEncoding.oggopus },
  { description: "MP3 32k", fileExtension: "mp3", id: EAudioEncoding.mp3 },
  { description: "Uncompressed WAV", fileExtension: "wav", id: EAudioEncoding.linear16 },
  { description: "European phone (G.711 A-law)", fileExtension: "wav", id: EAudioEncoding.alaw },
  { description: "America/Japan phone (G.711 μ-law)", fileExtension: "wav", id: EAudioEncoding.mulaw },
]);

const logger = new ContextLogger("effects.synthesize");

const synthesizeEffect: Effects.EffectType<IEffectModel, ISoundDataModel> = {
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
    const ctrl = $ctrl as ICtrl;
    const rootScope = $scope as IRootScope;
    const scope = $scope as IScope;

    ctrl.apiDefinitions ??= clone(apiDefinitions);
    ctrl.defaultSettings ??= clone(defaultSettings);
    ctrl.effectDefinitions ??= clone(effectDefinitions);
    ctrl.formatDefinitions ??= clone(formatDefinitions);
    ctrl.voices ??= dataProvider?.voiceInfo() ?? [];

    scope.openLink = rootScope.openLinkExternally;
    scope.isGeneratorCustomized = (): boolean => {
      return !(
        scope.effect.effectPitch === ctrl.defaultSettings.effectPitch &&
        scope.effect.effectProfiles === ctrl.defaultSettings.effectProfiles &&
        scope.effect.effectRate === ctrl.defaultSettings.effectRate &&
        scope.effect.effectVolume === ctrl.defaultSettings.effectVolume);
    };
    scope.resetGeneratorSettings = (): void => {
      scope.effect.effectPitch = ctrl.defaultSettings.effectPitch;
      scope.effect.effectProfiles = ctrl.defaultSettings.effectProfiles;
      scope.effect.effectRate = ctrl.defaultSettings.effectRate;
      scope.effect.effectVolume = ctrl.defaultSettings.effectVolume;
    };

    ctrl.$onInit = () => {
      logger.debug(`Ctrl oninit, scope effect is: "${(scope.effect ?? "null")}"`);
      if (!scope.effect) {
        scope.effect = structuredClone(ctrl.defaultSettings);
      }
    };

    scope.$onInit = () => {
      logger.debug(`Scope oninit, scope effect is: "${(scope.effect ?? "null")}"`);

      if (!scope.effect) {
        scope.effect = structuredClone(ctrl.defaultSettings);
      }
      if (!scope.effect.text) {
        scope.effect.text = ctrl.defaultSettings.text;
      }
      if (!scope.effect.voice) {
        scope.effect.voice = ctrl.defaultSettings.voice;
      }
      if (!scope.effect.language) {
        scope.effect.language = dataProvider?.language(scope.effect.voice)?.id ?? ctrl.defaultSettings.language;
      }
      if (scope.effect.effectPitch == null || !Number.isFinite(scope.effect.effectPitch) || scope.effect.effectPitch < -20.0 || scope.effect.effectPitch > 20.0) {
        scope.effect.effectPitch = ctrl.defaultSettings.effectPitch;
      }
      if (scope.effect.effectProfiles == null || !scope.effect.effectProfiles.every(desiredProfile => ctrl.effectDefinitions.some(effDef => effDef.id === desiredProfile))) {
        scope.effect.effectProfiles = ctrl.defaultSettings.effectProfiles;
      }
      if (scope.effect.effectRate == null || !Number.isFinite(scope.effect.effectRate) || scope.effect.effectRate < 0.25 || scope.effect.effectRate > 4.0) {
        scope.effect.effectRate = ctrl.defaultSettings.effectRate;
      }
      if (scope.effect.effectVolume == null || !Number.isFinite(scope.effect.effectVolume) || scope.effect.effectVolume < -96.0 || scope.effect.effectVolume > 16.0) {
        scope.effect.effectVolume = ctrl.defaultSettings.effectVolume;
      }
      if (scope.effect.outputVolume == null || !Number.isFinite(scope.effect.outputVolume) || scope.effect.outputVolume < 1 || scope.effect.outputVolume > 10) {
        scope.effect.outputVolume = ctrl.defaultSettings.outputVolume;
      }
      if (scope.effect.audioFormat == null || !ctrl.formatDefinitions.some(format => format.id === scope.effect.audioFormat)) {
        scope.effect.audioFormat = ctrl.defaultSettings.audioFormat;
      }
      if (scope.effect.apiVersion == null || !ctrl.apiDefinitions.some(apiDef => apiDef.id === scope.effect.apiVersion)) {
        scope.effect.apiVersion = ctrl.defaultSettings.apiVersion;
      }
      if (scope.effect.ssml == null) {
        scope.effect.ssml = ctrl.defaultSettings.ssml;
      }
      if (scope.effect.waitForPlayback == null) {
        scope.effect.waitForPlayback = ctrl.defaultSettings.waitForPlayback;
      }
    };
  },
  optionsValidator: (effect) => {
    const errors = [];
    if (effect == null) {
      errors.push("Something went wrong internally, as the effect is null");
      return errors;
    }

    if (effect.text.length < 1) {
      errors.push("Please input some text to speak aloud.");
    }
    if (effect.voice.length < 4) {
      errors.push("Please select a voice to use.");
    }
    if (effect.audioFormat === "MP3_64_KBPS" && effect.apiVersion !== "v1b1") {
      errors.push("MP3 64 kbps encoding is not available outside of the v1beta1 API");
    } else if (effect.audioFormat !== undefined && !formatDefinitions.some(fdef => fdef.id === effect.audioFormat)) {
      errors.push(`Unknown audio format ${effect.audioFormat}`);
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

    return errors;
  },
  onTriggerEvent: async (event) => {
    if (!folders || !modules || !settings) {
      throw new Error("Plugin appears to have been unloaded, cannot continue");
    }
    const { effect } = event;
    const { frontendCommunicator, /*httpServer,*/ path, resourceTokenManager } = modules;
    const { tmpDir } = folders;
    const audioFormat = formatDefinitions.find(fmtDef => fmtDef.id === effect.audioFormat || "OGG_OPUS");
    if (!audioFormat) {
      throw new Error(`Unknown audio format requested: ${(effect.audioFormat ?? "empty")}`);
    }

    // Step 1: synthesize audio and write it to a file.
    const filePath = path.join(tmpDir, `tts${uuid()}.${audioFormat.fileExtension}`);
    try {
      const api = effect.apiVersion === 'v1b1' ? gcp.textToSpeech.v1beta1 : gcp.textToSpeech.v1;
      const audioContent = await api.text.synthesize(
        {
          ...(effect.ssml === true && { ssml: effect.text } || { text: effect.text }),
        },
        {
          languageCode: effect.language ?? dataProvider?.language(effect.voice)?.id ?? "",
          name: effect.voice,
        },
        {
          audioEncoding: audioFormat.id as EAudioEncoding,
          ...(effect.effectProfiles !== undefined && effect.effectProfiles.length > 0 && { effectsProfileId: effect.effectProfiles as EAudioProfile[] }),
          ...(effect.effectPitch !== undefined && effect.effectPitch !== 0 && { pitch: effect.effectPitch }),
          ...(effect.effectRate !== undefined && effect.effectRate !== 1 && { speakingRate: effect.effectRate }),
          ...(effect.effectVolume !== undefined && effect.effectVolume !== 0 && { volumeGainDb: effect.effectVolume }),
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
        "getSoundDuration", { format: audioFormat.fileExtension, path: filePath },
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
      const soundData: ISoundDataModel = {
        audioOutputDevice: (effect.audioOutputDevice && effect.audioOutputDevice.label !== "App Default")
          ? effect.audioOutputDevice
          : settings.getAudioOutputDevice(),
        filepath: filePath,
        format: audioFormat.fileExtension,
        maxSoundLength: durationInSeconds,
        volume: effect.outputVolume ?? defaultSettings.outputVolume ?? 7,
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
