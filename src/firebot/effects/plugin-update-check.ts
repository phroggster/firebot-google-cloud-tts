import {
  Effects,
  EffectScope,
} from "@crowbartools/firebot-custom-scripts-types/types/effects";

import { EffectTriggerResponse, EffectType } from "./better-effects";
import consts from "../../consts";
import customPlugin from "../../main";
import { ContextLogger } from "../../context-logger";
import fsp from "fs/promises";
import pkgJson from "../../../package.json";

const queuesCache: Record<string, Effects.EffectList> = {};

// TODO: Create an effect here to manually check for plugin updates.

interface Data extends Record<string, unknown> {
  /** Whether or not to automatically download and install the update. Firebot
   * *will* need to be restarted, if so.
   */
  autoUpdate: boolean,
  /** Which releases are considered viable for updating to. "debug": ["alpha",
   * "beta", "release"], "beta": ["beta", "release"]
   */
  releaseChannel: "debug" | "alpha" | "beta" | "release",
  /** An effects list to run if a newer version is discovered. */
  updateAvailableEffects: Effects.EffectList,
};
interface Output extends Record<string, unknown> {
  /** The current plugin version. */
  currentVersion: string,
  /** The URL to directly download the freshest release from the selected
   * release channel.
   */
  downloadUrl: string | null,
  /** An error message if problems were encountered; `null` otherwise. */
  errorMessage: string | null,
  /** A boolean indicating whether or not a newer version is available for
   * download.
   */
  isUpdateAvailable: boolean,
  /** The version number of the latest release in the selected release channel
   * or the current version.
   */
  latestVersion: string,
  /** A URI to the releases page for the most recent release. */
  releasePageUrl: string,
  /** Whether or not the update was automatically downloaded and a Firebot
   * restart is now required.
   */
  updateInstalled: boolean,
};
interface Scope extends EffectScope<Data> {
  // read-only-ables
  defaultEffect: Data,
  isIntegrationConfigured: boolean,

  // read-writeables

  // functions
  bubbleStopChanged: (newValue: boolean) => void,
  stopChanged: (newValue: boolean) => void,
};

//interface EffectTriggerResponse extends EffectTriggerResponse<Output> { };

const updateCheckEffect: EffectType<Data, Scope, Output> = {
  definition: {
    id: consts.CHECK_UPDATE_EFFECT_ID,
    name: "Check for a GCP-TTS Plugin Update",
    categories: ["advanced", "integrations"],
    description: "Checks GitHub for an update to the Google Cloud TTS\
 (revised) plugin.",
    hidden: false,
    icon: "fad fa-cloud-download",
    outputs: [
      {
        label: "Update Available",
        description: "`true` if an update is available, `false` otherwise.",
        defaultName: "newerVersionAvailable",
      },
      {
        label: "Current Version",
        description: "A string representing the current plugin version number",
        defaultName: "currentVersion",
      },
      {
        label: "Error message",
        description: "`null` if everything worked fine; otherwise, a string\
 describing the error that was encountered",
        defaultName: "errorMessage",
      },
      {
        label: "Newest Version",
        description: "A string representing the newest plugin version.",
        defaultName: "newestVersion",
      },
      {
        label: "Release URL",
        description: "A string with the URL to the most recent release page.",
        defaultName: "newestReleaseUri",
      },
    ],
  },
  optionsTemplate: `
    <eos-container header="Configuration Required"
      ng-show="!isApikeyConfigured && !isOauthConfigured"
    >
      <div class="effect-info alert alert-warning">
        This effect requires the Google Cloud integration to be configured
        before it can execute. Visit <strong>Settings</strong> &gt;
        <strong>Integrations</strong> to configure it.
      </div>
    </eos-container>

    <eos-container header="API Version"
      pad-top="!isApikeyConfigured && !isOauthConfigured"
    >
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
        <ui-select-match placeholder="Select or search for a language…"
          style="position: relative;"
        >{{$select.selected.name}}</ui-select-match>
        <ui-select-choices style="position: relative;"
          repeat="localeInfo.id as localeInfo in locales |\
 filter: $select.search"
        >
          <div ng-bind-html="localeInfo.name | highlight: $select.search"></div>
        </ui-select-choices>
      </ui-select>
      <small class="muted">
        <strong>Limit the update to only the specified language.</strong>
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
 error occur. Useful if nested within a Conditional Effect, or Preset Effects\
 List, etc."
      />
    </eos-container>
  `,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionsController: ($scope: Scope, backendCommunicator: any) => {
    $scope.defaultEffect = {
      autoUpdate: false,
      releaseChannel: "release",
      updateAvailableEffects: {
        list: [],
      },
    };
    $scope.effect ??= $scope.defaultEffect;
    $scope.isIntegrationConfigured = backendCommunicator
      .fireEventSync(consts.signals.isIntegrationConfigured);
  },
  optionsValidator: () => {
    const errors: string[] = [];

    return errors;
  },
  onTriggerEvent: async (event) => {
    const logger = new ContextLogger("gcptts.effect.updateVoices");
    const { effect } = event;
    const { dataProvider, settingsProvider } = customPlugin;
    const { updateAvailableEffects } = effect;

    const result: EffectTriggerResponse<Output> = {
      execution: {
        bubbleStop: false,
        stop: false,
      },
      outputs: {
        currentVersion: consts.PLUGIN_VERSION,
        downloadUrl: "",
        errorMessage: null,
        isUpdateAvailable: false,
        latestVersion: consts.PLUGIN_VERSION,
        releasePageUrl: "",
        updateInstalled: false,
      },
      success: false,
    };

    // TODO: check for updates.

    if (result.outputs.isUpdateAvailable) {
      // Run effects list if a newer version is available in the release channel
      if (effect.updateAvailableEffects.list.some(e => !!e.active)) {
        const processRequest = {
          effects: updateAvailableEffects,
          outputs: result.outputs,
          trigger: event.trigger,
        };
        // If a queue is selected, this will return null/void. We can't really
        // await it from a queue.
        const ero = await customPlugin.effectRunner.processEffects(
          processRequest);
        if (ero && ero.stopEffectExecution) {
          // This effects list can bubble a stop event to us, unless it's in a
          // queue.
          result.execution = {
            bubbleStop: false,
            stop: ero.stopEffectExecution,
          };
          return result;
        }
      }

      // Try and auto-update.
      if (effect.autoUpdate === true && result.outputs.downloadUrl) {
        let downloadedScript: string = "";
        try {
          const request = new Request(result.outputs.downloadUrl, {
            method: "GET",
            headers: {
              "Accept": "text/javascript, text/plain, */*;q=0.75",
              "User-Agent": settingsProvider.userAgent,
            },
          });

          const fetchedResponse = await fetch(request);
          if (fetchedResponse.status === 200) {
            const fetchedText = await fetchedResponse.text();
            // TODO: Get path to script on-disk.
            const targetPath = customPlugin.path.join(
              SCRIPTS_DIR, `${pkgJson.scriptOutputName}.js`);
            try {
              await fsp.writeFile(targetPath, fetchedText, {
                encoding: "utf8",
                flag: 'w',
                flush: true,
                mode: 0o644,
              });
              // TODO: chat alert or notification or *something* that a restart
              // is needed.
            } catch (err) {
              const logMsg = "Failed to save update to file";
              result.outputs.errorMessage =
                `${logMsg}: ${(err as Error).message}`;
              logger.warnEx(logMsg, err as Error);
            }
          } else {
            // TODO: download failed? uri redirected?
            const logMsg = `Failed to download update (code\
 ${fetchedResponse.status}): ${fetchedResponse.statusText}`;
            result.outputs.errorMessage = logMsg;
            logger.warn(logMsg, fetchedResponse);
          }
        } catch (err) {
          const logMsg = `Failed to download ${result.outputs.latestVersion}\
 update`;
          logger.warnEx(logMsg, err as Error, err as Error);
          result.outputs.errorMessage = logMsg;
        }
      }
    }
    result.outputs.errorMessage = "Unable to connect to GitHub";
    logger.warn(result.outputs.errorMessage);
    return result;
  },
};

export default updateCheckEffect;
