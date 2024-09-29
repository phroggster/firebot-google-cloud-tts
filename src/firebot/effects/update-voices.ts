import { EffectScope } from "@crowbartools/firebot-custom-scripts-types/types/effects";

import { BetterEffectTriggerResult, BetterEffectType } from "./better-effects";
import consts from "../../consts";
import gcp from "../../gcp";
import customPlugin from "../../main";
import { LocaleInfo, VoiceInfo } from "../../types";
import { ContextLogger } from "../../context-logger";

type ApiRevision = "v1" | "v1b1";
interface Data extends Record<string, string> {
  apiVersion: ApiRevision;
  langCode: string;
  stopOnError: "false" | "stop" | "bubble" | "bubbleStop";
};
interface Output extends Record<string, unknown> {
  errorMessage: string | null,
  voices: {
    added: string[];
    removed: string[];
  },
};
interface Scope extends EffectScope<Data> {
  /** The default settings for the effect. */
  defaultEffect: Data;
  /** An array of the APIs available, each including an `id` and a `name`. */
  apiVersions: {id: string, name: string}[];
  /** An array of the locales available, each including an `id` and a `name`. */
  locales: LocaleInfo[];

  /** A boolean value indicating if the ApiKey integration has been configured. */
  isApikeyConfigured: boolean;
  /** A boolean value indicating if the OAuth integration has been configured. */
  isOauthConfigured: boolean;
  /** Whether a bubble stop request will be emitted after an error. Boolean accessibility cache of effect.stopOnError. */
  wantsBubbleStop: boolean;
  /** Whether a stop request will be emitted after an error. Boolean accessibility cache of effect.stopOnError. */
  wantsStop: boolean;

  /** Load the initial state of the control, including pulling in locales. */
  // init: () => void;
  /** Invoked when the bubble stop checkbox state is changed. */
  bubbleStopChanged: (newValue: boolean) => void;
  /** Get the name of an API from the id of an API. */
  getApiName: (apiId: string) => string | null;
  /** Get the name of a locale from the id of a locale. */
  getLanguageName: (localeId?: string | null) => string | null;
  /** Invoked when the stop checkbox state is changed. */
  stopChanged: (newValue: boolean) => void;
};

interface EffectTriggerResult extends BetterEffectTriggerResult<Output> { };

const updateVoicesEffect: BetterEffectType<Data, Scope, Output> = {
  definition: {
    id: consts.UPDATEVOICES_EFFECT_ID,
    name: "Update Google Cloud TTS Voices",
    categories: ["advanced", "integrations"],
    description: "Update the list of Google Cloud Text-To-Speech (TTS) voices.",
    hidden: false,
    icon: "fad fa-cloud-download",
    outputs: [
      {
        label: "Voices Changed",
        description: "An object containing two arrays of voice name strings: `added` and `removed`",
        defaultName: "voices",
      },
      {
        label: "Error message",
        description: "`null` if everything worked fine; otherwise, a string describing the error that was encountered",
        defaultName: "errorMessage",
      },
    ],
  },
  optionsTemplate: `
    <eos-container header="Configuration Required" ng-show="!isApikeyConfigured && !isOauthConfigured">
      <div class="effect-info alert alert-warning">
        This effect requires one of the Google Cloud integrations to be configured before it can execute. Visit <strong>Settings</strong> &gt; <strong>Integrations</strong> to configure it.
      </div>
    </eos-container>

    <eos-container header="API Version" pad-top="!isApikeyConfigured && !isOauthConfigured">
      <div class="btn-group" uib-dropdown>
        <button id="api-button" type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" uib-dropdown-toggle>
          <span>{{getApiName(effect.apiVersion)}}</span>
          <span class="caret"></span>
        </button>
        <ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="api-button">
          <li class="clickable" role="menuitem" ng-repeat="apiVer in apiVersions track by apiVer.id" ng-click="effect.apiVersion = apiVer.id">
            <a>{{apiVer.name}}</a>
          </li>
        </ul>
      </div>
    </eos-container>

    <eos-container header="Language" pad-top="true" ng-hide="locales.length < 1">
      <ui-select ng-model="effect.langCode" theme="bootstrap">
        <ui-select-match placeholder="Select or search for a language…" style="position: relative;">{{$select.selected.name}}</ui-select-match>
        <ui-select-choices repeat="localeInfo.id as localeInfo in locales | filter: $select.search" style="position: relative;">
          <div ng-bind-html="localeInfo.name | highlight: $select.search"></div>
        </ui-select-choices>
      </ui-select>
      <span><p><small class="muted"><strong>Limit the update to only the specified language.</strong></small></p></span>
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
        on-change="bubbleStopChanged(newValue)"
        tooltip="Bubble a stop request up to all parent effect lists should an error occur. Useful if nested within a Conditional Effect, or Preset Effects List, etc."
      />
    </eos-container>
  `,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionsController: (backendCommunicator: any, $q: any, $scope: Scope) => {
    $scope.defaultEffect = {
      apiVersion: "v1",
      langCode: "all",
      stopOnError: "false",
    };
    $scope.apiVersions = [
      { id: "v1", name: "Version 1" },
      { id: "v1b1", name: "Version 1 Beta 1" },
    ];
    $scope.locales = [{ id: "all", name: "All Languages" }];
    $scope.locales.push(...(backendCommunicator.fireEventSync("gcpttsGetLocales") || []));

    $scope.effect ??= $scope.defaultEffect;
    $scope.effect.apiVersion = $scope.effect.apiVersion === "v1" || $scope.effect.apiVersion === "v1b1" ? $scope.effect.apiVersion : $scope.defaultEffect.apiVersion;
    $scope.effect.langCode ??= $scope.defaultEffect.langCode;

    $scope.isApikeyConfigured = backendCommunicator.fireEventSync("gcpttsIsApikeyIntegrationConfigured") === true;
    $scope.isOauthConfigured = false; // TODO: Oauth backendCommunicator.fireEventSync("gcpttsIsOauthIntegrationConfigured");
    $scope.wantsBubbleStop = ($scope.effect.stopOnError === "bubble" || $scope.effect.stopOnError === "bubbleStop") === true;
    $scope.wantsStop = ($scope.effect.stopOnError === "stop" || $scope.effect.stopOnError === "bubbleStop") === true;

    $scope.bubbleStopChanged = (value) => {
      if (value === true) {
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
    $scope.getApiName = (apiId) => {
      return $scope.apiVersions.find(apiVer => apiVer.id === apiId)?.name || "Unknown";
    };
    $scope.getLanguageName = (localeId) => {
      if (!localeId || localeId === "all") {
        return "All Languages";
      }
      return $scope.locales.find(li => li.id === localeId)?.name || "Unknown";
    };
    $scope.stopChanged = (value) => {
      if (value === true) {
        if ($scope.effect.stopOnError === "bubble") {
          $scope.effect.stopOnError = "bubbleStop";
        } else {
          $scope.effect.stopOnError = "stop";
        }
      } else if (value === false) {
        if ($scope.effect.stopOnError === "bubbleStop") {
          $scope.effect.stopOnError = "bubble";
        } else {
          $scope.effect.stopOnError = "false";
        }
      }
    };
  },
  optionsValidator: (effect, $scope) => {
    const errors: string[] = [];
    if (effect.apiVersion && effect.apiVersion.toLowerCase() !== "v1" && effect.apiVersion.toLowerCase() !== "v1b1") {
      errors.push(`Unknown API version ${effect.apiVersion}`);
    }
    if (!effect.langCode) {
      errors.push("Language can not be null or empty");
    } else if ($scope.locales && $scope.locales.length > 0) {
      if (!$scope.locales.some(li => li.id === effect.langCode)) {
        errors.push(`Language "${effect.langCode}" doesn't appear to be supported`);
      }
    }
    return errors;
  },
  onTriggerEvent: async (event) => {
    const logger = new ContextLogger("gcptts.effect.updateVoices");
    const { effect } = event;
    const { dataProvider } = customPlugin;

    const result: EffectTriggerResult = {
      execution: {
        bubbleStop: effect.stopOnError === "bubble" || effect.stopOnError === "bubbleStop",
        stop: effect.stopOnError === "stop" || effect.stopOnError === "bubbleStop",
      },
      outputs: {
        errorMessage: null,
        voices: {
          added: [],
          removed: [],
        },
      },
      success: false,
    };

    const langCode = effect.langCode && effect.langCode !== "all" ? effect.langCode : undefined;
    const forLangLogMsg = langCode ? `for langCode "${langCode}"` : "for all languages";
    let voices: VoiceInfo[] = [];
    try {
      if (effect.apiVersion === "v1b1") {
        voices = await gcp.textToSpeech.v1beta1.voices.list(langCode);
      } else {
        voices = await gcp.textToSpeech.v1.voices.list(langCode);
      }
    } catch (err) {
      result.outputs.errorMessage = `Problem fetching voices list from api ${effect.apiVersion}: ${(err as Error).message}`;
      logger.errorEx(`Problem fetching voices list from api ${effect.apiVersion} ${forLangLogMsg}`, err as Error);
      return result;
    }

    // assume success from here, even if it might be Pyrrhic.
    result.execution = undefined;
    result.success = true;
    if (voices && voices.length > 0) {
      const { newVoiceNames, removedVoiceNames } = dataProvider.replaceVoices(voices, langCode);

      result.outputs.voices = {
        added: newVoiceNames,
        removed: removedVoiceNames,
      };
      logger.info(`Got voices list from Google api ${effect.apiVersion} ${forLangLogMsg}, with ${voices.length} voices. ${newVoiceNames.length} new voices, and ${removedVoiceNames.length} were removed.`);
      return result;
    }

    result.outputs.errorMessage = "No voices were received: invalid langCode, or integrations are offline";
    logger.warn(`Received no voices from Google api ${effect.apiVersion} ${forLangLogMsg}`);
    return result;
  },
};

export default updateVoicesEffect;
