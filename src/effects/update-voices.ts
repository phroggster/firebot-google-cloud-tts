import { Effects, EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import path from "path";
import { v4 as uuid } from "uuid";

import consts from "../consts";
import { ContextLogger } from "../context-logger";
import gcp from "../google-cloud-api";
import { VoiceInfo, VoicesInfo } from "../types";
import { wait } from "../utils";

const logger = new ContextLogger("fx.update-voices");

interface EffectModel {
  apiRevision?: string;
  langCode?: string;
};

interface Scope extends EffectScope<EffectModel> {
  defaultSettings: EffectModel;
};

const updateVoicesEffect: Effects.EffectType<EffectModel> = {
  definition: {
    id: consts.UPDATEVOICES_EFFECT_ID,
    name: "Update Google Cloud revised Voices",
    description: "Update the list of Google Cloud revised TTS voices.",
    icon: "fad fa-cloud-download",
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
                        <small class="muted"><strong>Pricing: {{getPricingTier(voiceInfo)}} | Tech: {{getVoiceTech(voiceInfo)}} | {{voiceInfo.language}} | {{voiceInfo.gender}}</small>
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
  optionsController: ($scope: Scope, $q: any, $rootScope: any, backendCommunicator: any) => {
    $scope.defaultSettings = Object.freeze<EffectModel>({
      apiRevision: "v1",
      langCode: "all"
    });

    if ($scope.effect == null) {
      $scope.effect = $scope.defaultSettings;
    }
    if (!$scope.effect.apiRevision || $scope.effect.apiRevision.length < 2) {
      $scope.effect.apiRevision = $scope.defaultSettings.apiRevision;
    }
    if (!$scope.effect.langCode || $scope.effect.langCode.length < 2) {
      $scope.effect.langCode = $scope.defaultSettings.langCode;
    }
  },
  optionsValidator: (effect) => {
    const errors: string[] = [];
    if (effect.apiRevision && effect.apiRevision != "v1" && effect.apiRevision != "v1b1") {
      errors.push(`Unknown API version ${effect.apiRevision}`);
    }
    // TODO: verify lang code...
    return errors;
  },
  onTriggerEvent: async (event) => {
    const { effect, trigger } = event;
    let { langCode, apiRevision } = effect;

    if (!apiRevision || apiRevision != "v1b1") {
      apiRevision = "v1";
    }

    if (langCode == "all" || !langCode || langCode.length < 2) {
      langCode = null;
    }
    const langLogText = langCode ? ` for lang "${langCode}"` : "";

    let voicesInfo: VoiceInfo[] = undefined;
    try {
      if (effect.apiRevision == "v1") {
        voicesInfo = await gcp.textToSpeech.v1.voices.list(langCode);
      } else {
        voicesInfo = await gcp.textToSpeech.v1beta1.voices.list(langCode);
      }
    } catch (err) {
      logger.exception(`Error fetching voices list from api ${apiRevision}{langLogText}`, err);
      return true;
    }

    // TODO: Update data source

    if (voicesInfo && voicesInfo.length > 0) {
      logger.info(`updated voices list from api ${apiRevision}${langLogText}, got ${voicesInfo.length} voices.`);
    } else {
      logger.warn(`Received zero voices from api ${apiRevision}${langLogText}`);
    }
    return true;
  }
}

export default updateVoicesEffect;
