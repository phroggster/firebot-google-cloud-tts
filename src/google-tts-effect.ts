import { ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { Effects, EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { FirebotSettings } from "@crowbartools/firebot-custom-scripts-types/types/settings";
import { v4 as uuid } from "uuid";

import { consts } from "./consts";
import { googleCloudService } from "./google-cloud-service";
import { GoogleTtsEffectModel, VoiceInfo } from "./types";
import { tmpDir, wait } from "./utils";

/** The scope datamodel for a Google Cloud Platform Text-To-Speech voice effect for Firebot. */
interface Scope extends EffectScope<GoogleTtsEffectModel> {
    /** An array of all voices available for speech synthesis. */
    allVoices: Array<VoiceInfo>;
    /** A read-only object representing the default effect settings. */
    defaultSettings: GoogleTtsEffectModel;

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
    /** Returns the pricing tier that a voice utilizes.
     * @param voiceInfo An object representing a voice available for text-to-speech synthesis.
     */
    getPricingTier(voiceInfo: VoiceInfo): string;
    /** Returns the technology that a voice utilizes.
     * @param voiceInfo An object representing a voice available for text-to-speech synthesis.
     */
    getVoiceTech(voiceInfo: VoiceInfo): string;

    /** Returns a value indicating if any audio effects will be applied to the TTS synthesis. */
    isGeneratorCustomized(): boolean;
    /** Resets any generator audio effects to defaults. Has no effect if isGeneratorCustomized returns false. */
    resetGeneratorSettings(): void;
};

export let googleTtsEffectType: Effects.EffectType<GoogleTtsEffectModel/*, OverlayData*/> = null;

export function initGoogleTtsEffectType(
    modules: ScriptModules,
    settings: FirebotSettings
) {
    const { effectManager, frontendCommunicator, fs, httpServer, logger, path, resourceTokenManager } = modules;
    logger.info("google-tts-effect: Initializing Google TTS Effect.");

    googleTtsEffectType = {
        definition: {
            id: consts.EFFECT_ID,
            name: "Text-To-Speech (Google Cloud)",
            description: "Have Firebot read out some text using Google Cloud Platform.",
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
            // Taken from gtts-voicelist-converter.ods
            $scope.allVoices = [
                { language: "Afrikaans (South Africa)", name: "af-ZA-Standard-A", gender: "Female" },
                { language: "Arabic", name: "ar-XA-Standard-A", gender: "Female" },
                { language: "Arabic", name: "ar-XA-Standard-B", gender: "Male" },
                { language: "Arabic", name: "ar-XA-Standard-C", gender: "Male" },
                { language: "Arabic", name: "ar-XA-Standard-D", gender: "Female" },
                { language: "Arabic", name: "ar-XA-Wavenet-A", gender: "Female" },
                { language: "Arabic", name: "ar-XA-Wavenet-B", gender: "Male" },
                { language: "Arabic", name: "ar-XA-Wavenet-C", gender: "Male" },
                { language: "Arabic", name: "ar-XA-Wavenet-D", gender: "Female" },
                { language: "Basque (Spain)", name: "eu-ES-Standard-A", gender: "Female" },
                { language: "Bengali (India)", name: "bn-IN-Standard-A", gender: "Female" },
                { language: "Bengali (India)", name: "bn-IN-Standard-B", gender: "Male" },
                { language: "Bengali (India)", name: "bn-IN-Standard-C", gender: "Female" },
                { language: "Bengali (India)", name: "bn-IN-Standard-D", gender: "Male" },
                { language: "Bengali (India)", name: "bn-IN-Wavenet-A", gender: "Female" },
                { language: "Bengali (India)", name: "bn-IN-Wavenet-B", gender: "Male" },
                { language: "Bengali (India)", name: "bn-IN-Wavenet-C", gender: "Female" },
                { language: "Bengali (India)", name: "bn-IN-Wavenet-D", gender: "Male" },
                { language: "Bulgarian (Bulgaria)", name: "bg-BG-Standard-A", gender: "Female" },
                { language: "Catalan (Spain)", name: "ca-ES-Standard-A", gender: "Female" },
                { language: "Chinese (Hong Kong)", name: "yue-HK-Standard-A", gender: "Female" },
                { language: "Chinese (Hong Kong)", name: "yue-HK-Standard-B", gender: "Male" },
                { language: "Chinese (Hong Kong)", name: "yue-HK-Standard-C", gender: "Female" },
                { language: "Chinese (Hong Kong)", name: "yue-HK-Standard-D", gender: "Male" },
                { language: "Czech (Czech Republic)", name: "cs-CZ-Standard-A", gender: "Female" },
                { language: "Czech (Czech Republic)", name: "cs-CZ-Wavenet-A", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Neural2-D", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Standard-A", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Standard-C", gender: "Male" },
                { language: "Danish (Denmark)", name: "da-DK-Standard-D", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Standard-E", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Wavenet-A", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Wavenet-C", gender: "Male" },
                { language: "Danish (Denmark)", name: "da-DK-Wavenet-D", gender: "Female" },
                { language: "Danish (Denmark)", name: "da-DK-Wavenet-E", gender: "Female" },
                { language: "Dutch (Belgium)", name: "nl-BE-Standard-A", gender: "Female" },
                { language: "Dutch (Belgium)", name: "nl-BE-Standard-B", gender: "Male" },
                { language: "Dutch (Belgium)", name: "nl-BE-Wavenet-A", gender: "Female" },
                { language: "Dutch (Belgium)", name: "nl-BE-Wavenet-B", gender: "Male" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Standard-A", gender: "Female" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Standard-B", gender: "Male" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Standard-C", gender: "Male" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Standard-D", gender: "Female" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Standard-E", gender: "Female" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Wavenet-A", gender: "Female" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Wavenet-B", gender: "Male" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Wavenet-C", gender: "Male" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Wavenet-D", gender: "Female" },
                { language: "Dutch (Netherlands)", name: "nl-NL-Wavenet-E", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Neural2-A", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Neural2-B", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Neural2-C", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Neural2-D", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-News-E", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-News-F", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-News-G", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Polyglot-1", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Standard-A", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Standard-B", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Standard-C", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Standard-D", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Wavenet-A", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Wavenet-B", gender: "Male" },
                { language: "English (Australia)", name: "en-AU-Wavenet-C", gender: "Female" },
                { language: "English (Australia)", name: "en-AU-Wavenet-D", gender: "Male" },
                { language: "English (India)", name: "en-IN-Neural2-A", gender: "Female" },
                { language: "English (India)", name: "en-IN-Neural2-B", gender: "Male" },
                { language: "English (India)", name: "en-IN-Neural2-C", gender: "Male" },
                { language: "English (India)", name: "en-IN-Neural2-D", gender: "Female" },
                { language: "English (India)", name: "en-IN-Standard-A", gender: "Female" },
                { language: "English (India)", name: "en-IN-Standard-B", gender: "Male" },
                { language: "English (India)", name: "en-IN-Standard-C", gender: "Male" },
                { language: "English (India)", name: "en-IN-Standard-D", gender: "Female" },
                { language: "English (India)", name: "en-IN-Wavenet-A", gender: "Female" },
                { language: "English (India)", name: "en-IN-Wavenet-B", gender: "Male" },
                { language: "English (India)", name: "en-IN-Wavenet-C", gender: "Male" },
                { language: "English (India)", name: "en-IN-Wavenet-D", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Neural2-A", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Neural2-B", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Neural2-C", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Neural2-D", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Neural2-F", gender: "Female" },
                { language: "English (UK)", name: "en-GB-News-G", gender: "Female" },
                { language: "English (UK)", name: "en-GB-News-H", gender: "Female" },
                { language: "English (UK)", name: "en-GB-News-I", gender: "Female" },
                { language: "English (UK)", name: "en-GB-News-J", gender: "Male" },
                { language: "English (UK)", name: "en-GB-News-K", gender: "Male" },
                { language: "English (UK)", name: "en-GB-News-L", gender: "Male" },
                { language: "English (UK)", name: "en-GB-News-M", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Standard-A", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Standard-B", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Standard-C", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Standard-D", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Standard-F", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Studio-B", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Studio-C", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Wavenet-A", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Wavenet-B", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Wavenet-C", gender: "Female" },
                { language: "English (UK)", name: "en-GB-Wavenet-D", gender: "Male" },
                { language: "English (UK)", name: "en-GB-Wavenet-F", gender: "Female" },
                { language: "English (US)", name: "en-US-Casual-K", gender: "Male" },
                { language: "English (US)", name: "en-US-Journey-D", gender: "Male" },
                { language: "English (US)", name: "en-US-Journey-F", gender: "Female" },
                { language: "English (US)", name: "en-US-Journey-O", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-A", gender: "Male" },
                { language: "English (US)", name: "en-US-Neural2-C", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-D", gender: "Male" },
                { language: "English (US)", name: "en-US-Neural2-E", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-F", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-G", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-H", gender: "Female" },
                { language: "English (US)", name: "en-US-Neural2-I", gender: "Male" },
                { language: "English (US)", name: "en-US-Neural2-J", gender: "Male" },
                { language: "English (US)", name: "en-US-News-K", gender: "Female" },
                { language: "English (US)", name: "en-US-News-L", gender: "Female" },
                { language: "English (US)", name: "en-US-News-N", gender: "Male" },
                { language: "English (US)", name: "en-US-Polyglot-1", gender: "Male" },
                { language: "English (US)", name: "en-US-Standard-A", gender: "Male" },
                { language: "English (US)", name: "en-US-Standard-B", gender: "Male" },
                { language: "English (US)", name: "en-US-Standard-C", gender: "Female" },
                { language: "English (US)", name: "en-US-Standard-D", gender: "Male" },
                { language: "English (US)", name: "en-US-Standard-E", gender: "Female" },
                { language: "English (US)", name: "en-US-Standard-F", gender: "Female" },
                { language: "English (US)", name: "en-US-Standard-G", gender: "Female" },
                { language: "English (US)", name: "en-US-Standard-H", gender: "Female" },
                { language: "English (US)", name: "en-US-Standard-I", gender: "Male" },
                { language: "English (US)", name: "en-US-Standard-J", gender: "Male" },
                { language: "English (US)", name: "en-US-Studio-O", gender: "Female" },
                { language: "English (US)", name: "en-US-Studio-Q", gender: "Male" },
                { language: "English (US)", name: "en-US-Wavenet-A", gender: "Male" },
                { language: "English (US)", name: "en-US-Wavenet-B", gender: "Male" },
                { language: "English (US)", name: "en-US-Wavenet-C", gender: "Female" },
                { language: "English (US)", name: "en-US-Wavenet-D", gender: "Male" },
                { language: "English (US)", name: "en-US-Wavenet-E", gender: "Female" },
                { language: "English (US)", name: "en-US-Wavenet-F", gender: "Female" },
                { language: "English (US)", name: "en-US-Wavenet-G", gender: "Female" },
                { language: "English (US)", name: "en-US-Wavenet-H", gender: "Female" },
                { language: "English (US)", name: "en-US-Wavenet-I", gender: "Male" },
                { language: "English (US)", name: "en-US-Wavenet-J", gender: "Male" },
                { language: "Filipino (Philippines)", name: "fil-PH-Standard-A", gender: "Female" },
                { language: "Filipino (Philippines)", name: "fil-PH-Standard-B", gender: "Female" },
                { language: "Filipino (Philippines)", name: "fil-PH-Standard-C", gender: "Male" },
                { language: "Filipino (Philippines)", name: "fil-PH-Standard-D", gender: "Male" },
                { language: "Filipino (Philippines)", name: "fil-PH-Wavenet-A", gender: "Female" },
                { language: "Filipino (Philippines)", name: "fil-PH-Wavenet-B", gender: "Female" },
                { language: "Filipino (Philippines)", name: "fil-PH-Wavenet-C", gender: "Male" },
                { language: "Filipino (Philippines)", name: "fil-PH-Wavenet-D", gender: "Male" },
                { language: "Filipino (Philippines)", name: "fil-ph-Neural2-A", gender: "Female" },
                { language: "Filipino (Philippines)", name: "fil-ph-Neural2-D", gender: "Male" },
                { language: "Finnish (Finland)", name: "fi-FI-Standard-A", gender: "Female" },
                { language: "Finnish (Finland)", name: "fi-FI-Wavenet-A", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Neural2-A", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Neural2-B", gender: "Male" },
                { language: "French (Canada)", name: "fr-CA-Neural2-C", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Neural2-D", gender: "Male" },
                { language: "French (Canada)", name: "fr-CA-Standard-A", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Standard-B", gender: "Male" },
                { language: "French (Canada)", name: "fr-CA-Standard-C", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Standard-D", gender: "Male" },
                { language: "French (Canada)", name: "fr-CA-Wavenet-A", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Wavenet-B", gender: "Male" },
                { language: "French (Canada)", name: "fr-CA-Wavenet-C", gender: "Female" },
                { language: "French (Canada)", name: "fr-CA-Wavenet-D", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Neural2-A", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Neural2-B", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Neural2-C", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Neural2-D", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Neural2-E", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Polyglot-1", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Standard-A", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Standard-B", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Standard-C", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Standard-D", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Standard-E", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Studio-A", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Studio-D", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Wavenet-A", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Wavenet-B", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Wavenet-C", gender: "Female" },
                { language: "French (France)", name: "fr-FR-Wavenet-D", gender: "Male" },
                { language: "French (France)", name: "fr-FR-Wavenet-E", gender: "Female" },
                { language: "Galician (Spain)", name: "gl-ES-Standard-A", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Neural2-A", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Neural2-B", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Neural2-C", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Neural2-D", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Neural2-F", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Polyglot-1", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Standard-A", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Standard-B", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Standard-C", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Standard-D", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Standard-E", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Standard-F", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Studio-B", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Studio-C", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Wavenet-A", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Wavenet-B", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Wavenet-C", gender: "Female" },
                { language: "German (Germany)", name: "de-DE-Wavenet-D", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Wavenet-E", gender: "Male" },
                { language: "German (Germany)", name: "de-DE-Wavenet-F", gender: "Female" },
                { language: "Greek (Greece)", name: "el-GR-Standard-A", gender: "Female" },
                { language: "Greek (Greece)", name: "el-GR-Wavenet-A", gender: "Female" },
                { language: "Gujarati (India)", name: "gu-IN-Standard-A", gender: "Female" },
                { language: "Gujarati (India)", name: "gu-IN-Standard-B", gender: "Male" },
                { language: "Gujarati (India)", name: "gu-IN-Standard-C", gender: "Female" },
                { language: "Gujarati (India)", name: "gu-IN-Standard-D", gender: "Male" },
                { language: "Gujarati (India)", name: "gu-IN-Wavenet-A", gender: "Female" },
                { language: "Gujarati (India)", name: "gu-IN-Wavenet-B", gender: "Male" },
                { language: "Gujarati (India)", name: "gu-IN-Wavenet-C", gender: "Female" },
                { language: "Gujarati (India)", name: "gu-IN-Wavenet-D", gender: "Male" },
                { language: "Hebrew (Israel)", name: "he-IL-Standard-A", gender: "Female" },
                { language: "Hebrew (Israel)", name: "he-IL-Standard-B", gender: "Male" },
                { language: "Hebrew (Israel)", name: "he-IL-Standard-C", gender: "Female" },
                { language: "Hebrew (Israel)", name: "he-IL-Standard-D", gender: "Male" },
                { language: "Hebrew (Israel)", name: "he-IL-Wavenet-A", gender: "Female" },
                { language: "Hebrew (Israel)", name: "he-IL-Wavenet-B", gender: "Male" },
                { language: "Hebrew (Israel)", name: "he-IL-Wavenet-C", gender: "Female" },
                { language: "Hebrew (Israel)", name: "he-IL-Wavenet-D", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Neural2-A", gender: "Female" },
                { language: "Hindi (India)", name: "hi-IN-Neural2-B", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Neural2-C", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Neural2-D", gender: "Female" },
                { language: "Hindi (India)", name: "hi-IN-Standard-A", gender: "Female" },
                { language: "Hindi (India)", name: "hi-IN-Standard-B", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Standard-C", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Standard-D", gender: "Female" },
                { language: "Hindi (India)", name: "hi-IN-Wavenet-A", gender: "Female" },
                { language: "Hindi (India)", name: "hi-IN-Wavenet-B", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Wavenet-C", gender: "Male" },
                { language: "Hindi (India)", name: "hi-IN-Wavenet-D", gender: "Female" },
                { language: "Hungarian (Hungary)", name: "hu-HU-Standard-A", gender: "Female" },
                { language: "Hungarian (Hungary)", name: "hu-HU-Wavenet-A", gender: "Female" },
                { language: "Icelandic (Iceland)", name: "is-IS-Standard-A", gender: "Female" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Standard-A", gender: "Female" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Standard-B", gender: "Male" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Standard-C", gender: "Male" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Standard-D", gender: "Female" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Wavenet-A", gender: "Female" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Wavenet-B", gender: "Male" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Wavenet-C", gender: "Male" },
                { language: "Indonesian (Indonesia)", name: "id-ID-Wavenet-D", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Neural2-A", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Neural2-C", gender: "Male" },
                { language: "Italian (Italy)", name: "it-IT-Standard-A", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Standard-B", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Standard-C", gender: "Male" },
                { language: "Italian (Italy)", name: "it-IT-Standard-D", gender: "Male" },
                { language: "Italian (Italy)", name: "it-IT-Wavenet-A", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Wavenet-B", gender: "Female" },
                { language: "Italian (Italy)", name: "it-IT-Wavenet-C", gender: "Male" },
                { language: "Italian (Italy)", name: "it-IT-Wavenet-D", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Neural2-B", gender: "Female" },
                { language: "Japanese (Japan)", name: "ja-JP-Neural2-C", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Neural2-D", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Standard-A", gender: "Female" },
                { language: "Japanese (Japan)", name: "ja-JP-Standard-B", gender: "Female" },
                { language: "Japanese (Japan)", name: "ja-JP-Standard-C", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Standard-D", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Wavenet-A", gender: "Female" },
                { language: "Japanese (Japan)", name: "ja-JP-Wavenet-B", gender: "Female" },
                { language: "Japanese (Japan)", name: "ja-JP-Wavenet-C", gender: "Male" },
                { language: "Japanese (Japan)", name: "ja-JP-Wavenet-D", gender: "Male" },
                { language: "Kannada (India)", name: "kn-IN-Standard-A", gender: "Female" },
                { language: "Kannada (India)", name: "kn-IN-Standard-B", gender: "Male" },
                { language: "Kannada (India)", name: "kn-IN-Standard-C", gender: "Female" },
                { language: "Kannada (India)", name: "kn-IN-Standard-D", gender: "Male" },
                { language: "Kannada (India)", name: "kn-IN-Wavenet-A", gender: "Female" },
                { language: "Kannada (India)", name: "kn-IN-Wavenet-B", gender: "Male" },
                { language: "Kannada (India)", name: "kn-IN-Wavenet-C", gender: "Female" },
                { language: "Kannada (India)", name: "kn-IN-Wavenet-D", gender: "Male" },
                { language: "Korean (South Korea)", name: "ko-KR-Neural2-A", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Neural2-B", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Neural2-C", gender: "Male" },
                { language: "Korean (South Korea)", name: "ko-KR-Standard-A", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Standard-B", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Standard-C", gender: "Male" },
                { language: "Korean (South Korea)", name: "ko-KR-Standard-D", gender: "Male" },
                { language: "Korean (South Korea)", name: "ko-KR-Wavenet-A", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Wavenet-B", gender: "Female" },
                { language: "Korean (South Korea)", name: "ko-KR-Wavenet-C", gender: "Male" },
                { language: "Korean (South Korea)", name: "ko-KR-Wavenet-D", gender: "Male" },
                { language: "Latvian (Latvia)", name: "lv-LV-Standard-A", gender: "Male" },
                { language: "Lithuanian (Lithuania)", name: "lt-LT-Standard-A", gender: "Male" },
                { language: "Malay (Malaysia)", name: "ms-MY-Standard-A", gender: "Female" },
                { language: "Malay (Malaysia)", name: "ms-MY-Standard-B", gender: "Male" },
                { language: "Malay (Malaysia)", name: "ms-MY-Standard-C", gender: "Female" },
                { language: "Malay (Malaysia)", name: "ms-MY-Standard-D", gender: "Male" },
                { language: "Malay (Malaysia)", name: "ms-MY-Wavenet-A", gender: "Female" },
                { language: "Malay (Malaysia)", name: "ms-MY-Wavenet-B", gender: "Male" },
                { language: "Malay (Malaysia)", name: "ms-MY-Wavenet-C", gender: "Female" },
                { language: "Malay (Malaysia)", name: "ms-MY-Wavenet-D", gender: "Male" },
                { language: "Malayalam (India)", name: "ml-IN-Standard-A", gender: "Female" },
                { language: "Malayalam (India)", name: "ml-IN-Standard-B", gender: "Male" },
                { language: "Malayalam (India)", name: "ml-IN-Standard-C", gender: "Female" },
                { language: "Malayalam (India)", name: "ml-IN-Standard-D", gender: "Male" },
                { language: "Malayalam (India)", name: "ml-IN-Wavenet-A", gender: "Female" },
                { language: "Malayalam (India)", name: "ml-IN-Wavenet-B", gender: "Male" },
                { language: "Malayalam (India)", name: "ml-IN-Wavenet-C", gender: "Female" },
                { language: "Malayalam (India)", name: "ml-IN-Wavenet-D", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-CN-Standard-A", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-CN-Standard-B", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-CN-Standard-C", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-CN-Standard-D", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-CN-Wavenet-A", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-CN-Wavenet-B", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-CN-Wavenet-C", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-CN-Wavenet-D", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-TW-Standard-A", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-TW-Standard-B", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-TW-Standard-C", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-TW-Wavenet-A", gender: "Female" },
                { language: "Mandarin Chinese", name: "cmn-TW-Wavenet-B", gender: "Male" },
                { language: "Mandarin Chinese", name: "cmn-TW-Wavenet-C", gender: "Male" },
                { language: "Marathi (India)", name: "mr-IN-Standard-A", gender: "Female" },
                { language: "Marathi (India)", name: "mr-IN-Standard-B", gender: "Male" },
                { language: "Marathi (India)", name: "mr-IN-Standard-C", gender: "Female" },
                { language: "Marathi (India)", name: "mr-IN-Wavenet-A", gender: "Female" },
                { language: "Marathi (India)", name: "mr-IN-Wavenet-B", gender: "Male" },
                { language: "Marathi (India)", name: "mr-IN-Wavenet-C", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Standard-A", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Standard-B", gender: "Male" },
                { language: "Norwegian (Norway)", name: "nb-NO-Standard-C", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Standard-D", gender: "Male" },
                { language: "Norwegian (Norway)", name: "nb-NO-Standard-E", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Wavenet-A", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Wavenet-B", gender: "Male" },
                { language: "Norwegian (Norway)", name: "nb-NO-Wavenet-C", gender: "Female" },
                { language: "Norwegian (Norway)", name: "nb-NO-Wavenet-D", gender: "Male" },
                { language: "Norwegian (Norway)", name: "nb-NO-Wavenet-E", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Standard-A", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Standard-B", gender: "Male" },
                { language: "Polish (Poland)", name: "pl-PL-Standard-C", gender: "Male" },
                { language: "Polish (Poland)", name: "pl-PL-Standard-D", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Standard-E", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Wavenet-A", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Wavenet-B", gender: "Male" },
                { language: "Polish (Poland)", name: "pl-PL-Wavenet-C", gender: "Male" },
                { language: "Polish (Poland)", name: "pl-PL-Wavenet-D", gender: "Female" },
                { language: "Polish (Poland)", name: "pl-PL-Wavenet-E", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Neural2-A", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Neural2-B", gender: "Male" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Neural2-C", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Standard-A", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Standard-B", gender: "Male" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Standard-C", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Studio-B", gender: "Male" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Studio-C", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Wavenet-A", gender: "Female" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Wavenet-B", gender: "Male" },
                { language: "Portuguese (Brazil)", name: "pt-BR-Wavenet-C", gender: "Female" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Standard-A", gender: "Female" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Standard-B", gender: "Male" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Standard-C", gender: "Male" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Standard-D", gender: "Female" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Wavenet-A", gender: "Female" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Wavenet-B", gender: "Male" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Wavenet-C", gender: "Male" },
                { language: "Portuguese (Portugal)", name: "pt-PT-Wavenet-D", gender: "Female" },
                { language: "Punjabi (India)", name: "pa-IN-Standard-A", gender: "Female" },
                { language: "Punjabi (India)", name: "pa-IN-Standard-B", gender: "Male" },
                { language: "Punjabi (India)", name: "pa-IN-Standard-C", gender: "Female" },
                { language: "Punjabi (India)", name: "pa-IN-Standard-D", gender: "Male" },
                { language: "Punjabi (India)", name: "pa-IN-Wavenet-A", gender: "Female" },
                { language: "Punjabi (India)", name: "pa-IN-Wavenet-B", gender: "Male" },
                { language: "Punjabi (India)", name: "pa-IN-Wavenet-C", gender: "Female" },
                { language: "Punjabi (India)", name: "pa-IN-Wavenet-D", gender: "Male" },
                { language: "Romanian (Romania)", name: "ro-RO-Standard-A", gender: "Female" },
                { language: "Romanian (Romania)", name: "ro-RO-Wavenet-A", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Standard-A", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Standard-B", gender: "Male" },
                { language: "Russian (Russia)", name: "ru-RU-Standard-C", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Standard-D", gender: "Male" },
                { language: "Russian (Russia)", name: "ru-RU-Standard-E", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Wavenet-A", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Wavenet-B", gender: "Male" },
                { language: "Russian (Russia)", name: "ru-RU-Wavenet-C", gender: "Female" },
                { language: "Russian (Russia)", name: "ru-RU-Wavenet-D", gender: "Male" },
                { language: "Russian (Russia)", name: "ru-RU-Wavenet-E", gender: "Female" },
                { language: "Serbian (Cyrillic)", name: "sr-RS-Standard-A", gender: "Female" },
                { language: "Slovak (Slovakia)", name: "sk-SK-Standard-A", gender: "Female" },
                { language: "Slovak (Slovakia)", name: "sk-SK-Wavenet-A", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-A", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-B", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-C", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-D", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-E", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Neural2-F", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Polyglot-1", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Standard-A", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Standard-B", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Standard-C", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Standard-D", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Studio-C", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Studio-F", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Wavenet-B", gender: "Male" },
                { language: "Spanish (Spain)", name: "es-ES-Wavenet-C", gender: "Female" },
                { language: "Spanish (Spain)", name: "es-ES-Wavenet-D", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-Neural2-A", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-Neural2-B", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Neural2-C", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-News-D", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-News-E", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-News-F", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-News-G", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-Polyglot-1", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Standard-A", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-Standard-B", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Standard-C", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Studio-B", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Wavenet-A", gender: "Female" },
                { language: "Spanish (US)", name: "es-US-Wavenet-B", gender: "Male" },
                { language: "Spanish (US)", name: "es-US-Wavenet-C", gender: "Male" },
                { language: "Swedish (Sweden)", name: "sv-SE-Standard-A", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Standard-B", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Standard-C", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Standard-D", gender: "Male" },
                { language: "Swedish (Sweden)", name: "sv-SE-Standard-E", gender: "Male" },
                { language: "Swedish (Sweden)", name: "sv-SE-Wavenet-A", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Wavenet-B", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Wavenet-C", gender: "Male" },
                { language: "Swedish (Sweden)", name: "sv-SE-Wavenet-D", gender: "Female" },
                { language: "Swedish (Sweden)", name: "sv-SE-Wavenet-E", gender: "Male" },
                { language: "Tamil (India)", name: "ta-IN-Standard-A", gender: "Female" },
                { language: "Tamil (India)", name: "ta-IN-Standard-B", gender: "Male" },
                { language: "Tamil (India)", name: "ta-IN-Standard-C", gender: "Female" },
                { language: "Tamil (India)", name: "ta-IN-Standard-D", gender: "Male" },
                { language: "Tamil (India)", name: "ta-IN-Wavenet-A", gender: "Female" },
                { language: "Tamil (India)", name: "ta-IN-Wavenet-B", gender: "Male" },
                { language: "Tamil (India)", name: "ta-IN-Wavenet-C", gender: "Female" },
                { language: "Tamil (India)", name: "ta-IN-Wavenet-D", gender: "Male" },
                { language: "Telugu (India)", name: "te-IN-Standard-A", gender: "Female" },
                { language: "Telugu (India)", name: "te-IN-Standard-B", gender: "Male" },
                { language: "Thai (Thailand)", name: "th-TH-Neural2-C", gender: "Female" },
                { language: "Thai (Thailand)", name: "th-TH-Standard-A", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Standard-A", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Standard-B", gender: "Male" },
                { language: "Turkish (Turkey)", name: "tr-TR-Standard-C", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Standard-D", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Standard-E", gender: "Male" },
                { language: "Turkish (Turkey)", name: "tr-TR-Wavenet-A", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Wavenet-B", gender: "Male" },
                { language: "Turkish (Turkey)", name: "tr-TR-Wavenet-C", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Wavenet-D", gender: "Female" },
                { language: "Turkish (Turkey)", name: "tr-TR-Wavenet-E", gender: "Male" },
                { language: "Ukrainian (Ukraine)", name: "uk-UA-Standard-A", gender: "Female" },
                { language: "Ukrainian (Ukraine)", name: "uk-UA-Wavenet-A", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Neural2-A", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Neural2-D", gender: "Male" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Standard-A", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Standard-B", gender: "Male" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Standard-C", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Standard-D", gender: "Male" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Wavenet-A", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Wavenet-B", gender: "Male" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Wavenet-C", gender: "Female" },
                { language: "Vietnamese (Vietnam)", name: "vi-VN-Wavenet-D", gender: "Male" },
            ];
            $scope.defaultSettings = Object.freeze<GoogleTtsEffectModel>({
                text: "",
                language: "en-US",
                voice: "en-US-Standard-C",
                effectProfiles: [],
                effectPitch: 0.0,
                effectRate: 1.0,
                effectVolume: 0.0,
                audioOutputDevice: null,
                outputVolume: 10.0
            });
            //$scope.filters = {
            //    gender: "Any",
            //    language: "Any",
            //    name: "Any",
            //    pricing: "Any",
            //    technology: "Any"
            //};
            //$scope.isFiltersCollapsed = true;
            $scope.openLink = $rootScope.openLinkExternally;

            //$scope.filterByGender = (voiceList: Array<VoiceInfo>, gender?: string): Array<VoiceInfo> => {
            //    if ((gender?.length ?? 0) < 1 || gender == "Any" || (voiceList?.length ?? 0) < 1) {
            //        return voiceList;
            //    }
            //    return voiceList.filter((vi) => vi.gender == gender);
            //};
            //$scope.filterByLang = (voiceList: Array<VoiceInfo>, langCode?: string): Array<VoiceInfo> => {
            //    if ((langCode?.length ?? 0) < 1 || langCode == "Any" || (voiceList?.length ?? 0) < 1) {
            //        return voiceList;
            //    }
            //    return voiceList.filter((vd) => vd.name.startsWith(langCode));
            //};
            //$scope.filterByPricing = (voiceList: Array<VoiceInfo>, priceTier?: string): Array<VoiceInfo> => {
            //    if ((priceTier?.length ?? 0) < 1 || priceTier == "Any" || (voiceList?.length ?? 0) < 1) {
            //        return voiceList;
            //    }
            //    return voiceList.filter((vd) => $scope.getPricingTier(vd) == priceTier);
            //};
            //$scope.filterByTech = (voiceList: Array<VoiceInfo>, tech?: string): Array<VoiceInfo> => {
            //    if ((tech?.length ?? 0) < 1 || tech == "Any" || (voiceList?.length ?? 0) < 1) {
            //        return voiceList;
            //    }
            //    return voiceList.filter((vd) => $scope.getVoiceTech(vd) == tech);
            //};

            $scope.getLangCode = (voiceInfo: VoiceInfo): string => {
                if ((voiceInfo?.name?.length ?? 0) < 1) {
                    return "Unknown";
                }
                const endIdx = voiceInfo.name.lastIndexOf("-");
                const withLastHyphen = voiceInfo.name.substring(0, endIdx);
                const startIdx = withLastHyphen.lastIndexOf("-");
                return voiceInfo.name.substring(0, startIdx);
            };
            $scope.getPricingTier = (voiceInfo: VoiceInfo): string => {
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
                    for (var tier of ["Casual", /*"Journey",*/ "Neural2", "News", "Polyglot", "Wavenet"]) {
                        if (voiceInfo.name.includes(tier)) {
                            return "Premium";
                        }
                    }
                }
                return "Unknown";
            };
            $scope.getVoiceTech = (voiceInfo: VoiceInfo): string => {
                if ((voiceInfo?.name?.length ?? 0) < 4) {
                    return "Unknown";
                }
                const { name } = voiceInfo;
                const endIdx = name.lastIndexOf("-");
                const withoutLastHyphen = name.substring(0, endIdx);
                const startIdx = withoutLastHyphen.lastIndexOf("-");
                return withoutLastHyphen.substring(startIdx + 1, endIdx);
            };

            $scope.isGeneratorCustomized = (): boolean => {
                return !($scope.effect.effectPitch == $scope.defaultSettings.effectPitch &&
                    // $scope.effect.effectProfiles !== $scope.defaultSettings.effectProfiles ||
                    $scope.effect.effectRate == $scope.defaultSettings.effectRate &&
                    $scope.effect.effectVolume == $scope.defaultSettings.effectVolume);
            };
            $scope.resetGeneratorSettings = (): void => {
                $scope.effect.effectPitch = $scope.defaultSettings.effectPitch;
                $scope.effect.effectProfiles = $scope.defaultSettings.effectProfiles;
                $scope.effect.effectRate = $scope.defaultSettings.effectRate;
                $scope.effect.effectVolume = $scope.defaultSettings.effectVolume;
            };

            //$scope.selectableGenders = ["Any", "Female", "Male"];
            //$scope.selectableLanguages = ["Any"].concat($scope.allVoices.map((vi) => vi.language).filter((l, n, a) => a.indexOf(l) === n));
            //$scope.selectablePricingTiers = ["Any"].concat($scope.allVoices.map((vi) => $scope.getPricingTier(vi)).filter((t, n, a) => a.indexOf(t) === n));
            //$scope.selectableTechnologies = ["Any"].concat($scope.allVoices.map((vi) => $scope.getVoiceTech(vi)).filter((t, n, a) => a.indexOf(t) === n));

            if ($scope.effect == null) {
                $scope.effect = $scope.defaultSettings;
            }
            if (($scope.effect.voice?.length ?? 0) < 1) {
                $scope.effect.voice = $scope.defaultSettings.voice;
            }
            if (($scope.effect.text?.length ?? 0) < 1) {
                $scope.effect.text = $scope.defaultSettings.text;
            }
            if (($scope.effect.language?.length ?? 0) < 2) {
                $scope.effect.language = $scope.getLangCode($scope.allVoices.find((vi) => vi.name == $scope.effect.voice)) ?? $scope.defaultSettings.voice;
            }
            if ($scope.effect.effectProfiles == null) {
                $scope.effect.effectProfiles = [];
            } else {
                try {
                    googleCloudService.validateEffects($scope.effect.effectProfiles);
                }
                catch (err) {
                    $scope.effect.effectProfiles = [];
                }
            }
            if ($scope.effect.effectPitch == null || $scope.effect.effectPitch < -20.0 || $scope.effect.effectPitch > 20.0) {
                $scope.effect.effectPitch = 0.0;
            }
            if ($scope.effect.effectRate == null || $scope.effect.effectRate < 0.25 || $scope.effect.effectRate > 4.0) {
                $scope.effect.effectRate = 1.0;
            }
            if ($scope.effect.effectVolume == null || $scope.effect.effectVolume < -96.0 || $scope.effect.effectVolume > 16.0) {
                $scope.effect.effectVolume = 0.0;
            }
            if ($scope.effect.outputVolume == null || $scope.effect.outputVolume < 1 || $scope.effect.outputVolume > 10) {
                $scope.effect.outputVolume = 5;
            }
        },
        optionsValidator: (effect) => {
            const errors = [];
            if (effect === null) {
                errors.push("Something went wrong internally, as the effect is null");
            }
            if ((effect?.text?.length ?? 0) < 1) {
                errors.push("Please input some text to speak aloud.");
            }
            if ((effect?.voice?.length ?? 0) < 4) {
                errors.push("Please select a voice to use.");
            }
            return errors;
        },
        onTriggerEvent: async (event) => {
            interface SoundData {
                audioOutputDevice: any;
                filepath: string;
                format: string;
                maxSoundLength: number;
                volume: number;

                resourceToken?: string;
                overlayInstance?: string;
            };
            const { effect, sendDataToOverlay, trigger } = event;

            logger.debug("google-tts-effect.onTriggerEvent");

            try {
                if (!fs.existsSync(tmpDir)) {
                    logger.info(`google-tts-effect.onTriggerEvent: Attempting to create temporary directory at "${tmpDir}"`);
                    fs.mkdirSync(tmpDir, { recursive: true });
                }
            }
            catch (err) {
                logger.error("google-tts-effect.onTriggerEvent: Failed to create temporary directory for audio files", err);
                return true;
            }

            // Step 1: synthesize audio and write it to a file.
            const filePath = path.join(tmpDir, `tts${uuid()}.mp3`);
            try {
                const audioContent = await googleCloudService.synthesizeText(effect.text,
                    {
                        language: effect.language,
                        name: effect.voice
                    },
                    {
                        effects: effect.effectProfiles,
                        pitch: effect.effectPitch,
                        rate: effect.effectRate,
                        volume: effect.effectVolume,
                    });
                if (audioContent == null || audioContent.length < 1) {
                    logger.warn("google-tts-effect.onTriggerEvent: Received null from synthesizeText");
                    return true;
                }

                await fs.writeFile(filePath, Buffer.from(audioContent, 'base64'), () => {
                    logger.debug(`google-tts-effect.onTriggerEvent: wrote audio file to ${filePath}`);
                });
            } catch (err) {
                logger.error("google-tts-effect.onTriggerEvent: Caught exception during audio synthesis request", err);
                return true;
            }

            // Step 2: determine the audio file's playback length
            let durationInSeconds = 30;
            let durationInMils = durationInSeconds * 1000.0;
            try {
                // get the duration of this tts sound duration
                durationInSeconds = await frontendCommunicator.fireEventAsync<number>(
                    "getSoundDuration",
                    {
                        path: filePath,
                        format: "mp3",
                    }
                );
                durationInMils = (Math.round(durationInSeconds) || 1) * 1000;
            } catch (err) {
                logger.error("google-tts-effect.onTriggerEvent: Caught exception while determining audio duration", err);
                fs.unlink(filePath, (_) => { ; });
                return true;
            }

            // Step 3: play it
            try {
                const soundData = {
                    audioOutputDevice: (effect.audioOutputDevice?.label && effect.audioOutputDevice.label !== "App Default")
                        ? effect.audioOutputDevice
                        : settings.getAudioOutputDevice(),
                    filepath: filePath,
                    format: "mp3",
                    maxSoundLength: durationInSeconds,
                    volume: effect.outputVolume ?? 5.0,
                } as SoundData;

                // actually play the TTS audio
                if (soundData.audioOutputDevice.deviceId === "overlay") {
                    soundData.resourceToken = resourceTokenManager.storeResourcePath(soundData.filepath, durationInSeconds);

                    if (settings.useOverlayInstances() && effect.overlayInstance !== null && settings.getOverlayInstances().includes(effect.overlayInstance)) {
                        soundData.overlayInstance = effect.overlayInstance;
                    }

                    //sendDataToOverlay(data, effect.overlayInstance);
                    //httpServer.sendToOverlay("sound", data, effect.overlayInstance);
                    httpServer.sendToOverlay("sound", soundData as any);
                    logger.debug("google-tts-effect.onTriggerEvent: sent soundData to overlay");
                }
                else {
                    frontendCommunicator.send("playsound", soundData);
                    logger.debug("google-tts-effect.onTriggerEvent: sent soundData to playsound");
                }
            }
            catch (err) {
                logger.error("google-tts-effect.onTriggerEvent: Caught exception during audio submission", err);
                fs.unlink(filePath, (_) => { ; });
                return true;
            }

            // Step 4: wait for it to finish playing, then remove the audio file
            try {
                const waitPromise = wait(durationInMils).then(async function () {
                    await fs.unlink(filePath, (_) => {
                        logger.debug(`google-tts-effect: deleting audio file "${filePath}" as it has been completed`);
                    });
                });
                await waitPromise;
            }
            catch (err) {
                logger.error(`google-tts-effect.onTriggerEvent: failed to cleanup after ourselves; "${filePath}" can be manually deleted at your leisure"`, err);
            }

            // returning true tells the firebot effect system this effect has completed and that it can continue to the next effect
            logger.info(`google-tts-effect: finished synthesizing ${effect.text.length} characters.`)
            return true;
        }
    };
    effectManager.registerEffect(googleTtsEffectType);
}
