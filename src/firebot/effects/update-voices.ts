import {
  EffectScope,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";

import googleCloudApi from "../../google-cloud";
import { TtsApiRevision } from "../../google-cloud/text-to-speech";

import {
  EffectOutputs,
  EffectTriggerResponse,
  EffectType,
} from "./better-effects";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";
import { LocaleInfo, VoiceInfo } from "../../types";

interface Model extends Record<string, string> {
  apiVersion: TtsApiRevision;
  langCode: string;
  stopOnError: "continue" | "stop" | "bubble" | "bubbleStop";
};
interface Outputs extends EffectOutputs {
  errorMessage: string | null,
  voices: {
    added: string[];
    removed: string[];
  },
};
interface Scope extends EffectScope<Model> {
  /** The default settings for the effect. */
  defaultEffect: Model;
  /** An array of the APIs available, each including an `id` and a `name`. */
  apiVersions: {id: string, name: string}[];
  /** An array of the locales available, each including an `id` and a `name`. */
  locales: LocaleInfo[];

  /** A boolean value indicating if a GCP integration has been configured. */
  isIntegrationConfigured: boolean;
  /** Whether a bubble stop request will be emitted after an error. Boolean
   * accessibility cache for effect.stopOnError.
   */
  wantsBubbleStop: boolean;
  /** Whether a stop request will be emitted after an error. Boolean
   * accessibility cache for effect.stopOnError.
   */
  wantsStop: boolean;

  /** Invoked when the bubble stop checkbox state is changed. */
  bubbleStopChanged: (newValue: boolean) => void;
  /** Get the name of an API from the id of an API. */
  getApiName: (apiId: string) => string | null;
  /** Get the name of a locale from the id of a locale. */
  getLanguageName: (localeId?: string | null) => string | null;
  /** Invoked when the stop checkbox state is changed. */
  stopChanged: (newValue: boolean) => void;
};

const updateVoicesEffect: EffectType<Model, Scope, Outputs> = {
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
        description: "An object containing two arrays of voice names: `added`\
 and `removed`",
        defaultName: "voices",
      },
      {
        label: "Error message",
        description: "`null` if everything worked fine; otherwise, a string\
 describing the error that was encountered",
        defaultName: "errorMessage",
      },
    ],
  },
  optionsTemplate: `
    <eos-container
      header="Configuration Required" ng-show="!isIntegrationConfigured"
    >
      <div class="effect-info alert alert-warning">
        This effect requires the Google Cloud integration to be configured
        before it can execute. Visit <strong>Settings</strong> &gt;
        <strong>Integrations</strong> to configure it.
      </div>
    </eos-container>

    <eos-container header="API Version" pad-top="!isIntegrationConfigured">
      <div class="btn-group" uib-dropdown>
        <button id="api-button" type="button"
          class="btn btn-default dropdown-toggle" data-toggle="dropdown"
          aria-haspopup="true" aria-expanded="false" uib-dropdown-toggle
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
    </eos-container>

    <eos-container header="Language" pad-top="true"
      ng-hide="locales.length < 1"
    >
      <ui-select ng-model="effect.langCode" theme="bootstrap">
        <ui-select-match
          placeholder="Select or search for a language…"
          style="position: relative;"
        >{{$select.selected.name}}</ui-select-match>
        <ui-select-choices style="position: relative;"
        repeat="localeInfo.id as localeInfo in locales | filter: $select.search"
        >
          <div ng-bind-html="localeInfo.name | highlight: $select.search"></div>
        </ui-select-choices>
      </ui-select>
      <small class="muted">
        <strong>Limit the refresh to the specified language.</strong>
      </small>
    </eos-container>

    <eos-container header="Error Handling" pad-top="true">
      <firebot-checkbox
        label="Stop Effect List On Error"
        model="wantsStop"
        on-change="stopChanged(newValue)"
        tooltip="Request to stop future effects in the parent list from running\
 should an error occur."
      />
      <firebot-checkbox
        label="Bubble to Parent Effect Lists"
        model="wantsBubbleStop"
        on-change="bubbleStopChanged(newValue)"
        tooltip="Bubble a stop request up to all parent effect lists should an\
 error occur. Useful if nested within a Conditional Effect, or a Preset Effects\
 List, etc."
      />
    </eos-container>
  `,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionsController: ($scope: Scope, backendCommunicator: any) => {
    $scope.defaultEffect = Object.freeze<Model>({
      apiVersion: "v1",
      langCode: "all",
      stopOnError: "continue",
    });
    $scope.apiVersions = [
      { id: "v1", name: "Version 1" },
      { id: "v1beta1", name: "Version 1 Beta 1" },
    ];
    $scope.locales = [{ id: "all", name: "All Languages" }];
    $scope.locales.push(...(backendCommunicator
      .fireEventSync("gcpttsGetLocales") || []));

    $scope.effect ??= $scope.defaultEffect;
    $scope.effect.apiVersion = $scope.effect.apiVersion === "v1"
      || $scope.effect.apiVersion === "v1beta1"
      ? $scope.effect.apiVersion
      : $scope.defaultEffect.apiVersion;
    $scope.effect.langCode ??= $scope.defaultEffect.langCode;

    $scope.isIntegrationConfigured = backendCommunicator
      .fireEventSync(consts.signals.isIntegrationConfigured) === true;
    $scope.wantsBubbleStop = ($scope.effect.stopOnError === "bubble"
      || $scope.effect.stopOnError === "bubbleStop") === true;
    $scope.wantsStop = ($scope.effect.stopOnError === "stop"
      || $scope.effect.stopOnError === "bubbleStop") === true;

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
          $scope.effect.stopOnError = "continue";
        }
      }
    };
    $scope.getApiName = (apiId) => {
      return $scope.apiVersions.find(apiVer => apiVer.id === apiId)?.name
        || "Unknown";
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
          $scope.effect.stopOnError = "continue";
        }
      }
    };
  },
  optionsValidator: (effect, $scope) => {
    const errors: string[] = [];

    if (effect.apiVersion
      && effect.apiVersion.toLowerCase() !== "v1"
      && effect.apiVersion.toLowerCase() !== "v1beta1"
    ) {
      // can't lookup the name, it's clearly not in our apiVersions array
      errors.push(`Unknown API version ${effect.apiVersion}`);
    }

    if (!effect.langCode) {
      errors.push("Language code is null or empty");
    } else if (effect.langCode !== "all"
      && !$scope.locales.some(li => li.id === effect.langCode)
    ) {
      errors.push(`Language code "${effect.langCode}" isn't supported`);
    }
    return errors;
  },
  onTriggerEvent: async (event) => {
    const logger = new ContextLogger("gcptts.effect.updateVoices");
    const { effect } = event;
    const { dataProvider } = customPlugin;

    const result: EffectTriggerResponse<Outputs> = {
      execution: {
        bubbleStop: effect.stopOnError === "bubble"
          || effect.stopOnError === "bubbleStop",
        stop: effect.stopOnError === "stop"
          || effect.stopOnError === "bubbleStop",
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

    const langCode = effect.langCode?.toLowerCase() === "all"
      ? undefined
      : effect.langCode;
    const forLangLogMsg = langCode === undefined
      ? `for language code "${langCode}"`
      : "for all languages";
    let voices: VoiceInfo[] = [];
    try {
      const ttsapi = effect.apiVersion === "v1beta1"
        ? googleCloudApi.textToSpeech.v1beta1
        : googleCloudApi.textToSpeech.v1;
      voices = await ttsapi.voices.list(langCode);
    } catch (err) {
      const errMsg = `Error fetching voices list from api ${effect.apiVersion}\
 ${forLangLogMsg}`;
      result.outputs.errorMessage = `${errMsg}: ${(err as Error).message}`;
      logger.errorEx(errMsg, err as Error);
      return result;
    }

    // assume success from here, even if it /might/ be Pyrrhic.
    result.execution = undefined;
    result.success = true;

    if (voices && voices.length > 0 || langCode) {
      const {
        newVoiceNames,
        removedVoiceNames,
      } = dataProvider.replaceVoices(voices ?? [], langCode);

      result.outputs.voices = {
        added: newVoiceNames,
        removed: removedVoiceNames,
      };
      logger.info(`Got voices list from Google api ${effect.apiVersion}\
 ${forLangLogMsg}, with ${voices.length} voices. Added ${newVoiceNames.length}\
 new voices, and removed ${removedVoiceNames.length}.`);
    } else {
      result.outputs.errorMessage = "No voices were received";
      logger.warn(`Received no voices from Google api ${effect.apiVersion}\
 ${forLangLogMsg}`);
    }

    return result;
  },
};

export default updateVoicesEffect;
