import {
  Integration,
  IntegrationDefinition,
  IntegrationData,
  IntegrationEvents,
  ScriptModules,
} from "@crowbartools/firebot-custom-scripts-types";
import { FirebotParams } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { TypedEmitter } from "tiny-typed-emitter";

import { BetterIntegrationController} from "./better-integrations";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";

interface ApiKeyParams extends FirebotParams {
  connection: {
    /**
     * Optional. An HTTP-referer [sic] to supply with web requests from this integration. This can enable tighter
     * control of accepted credentials, but requires a bunch of setup to enable in the GCP console.
     */
    referrer?: string;
    /**
     * Optional. An user-agent string to append onto the "Firebot/{fb version} firebot-gcp-tts/{plugin version}" that
     * we supply by default. User agents aren't seemingly tracked in the GCP text-to-speech API by default, unless you
     * hook up additional monitoring APIs in the GCP console or perhaps do long-form TTS requests.
     *
     * This does not add any additional security, it adds *at best* client instance billing isolation.
     */
    userAgent?: string;
  };
}

const integrationDefinition: IntegrationDefinition<ApiKeyParams> = {
  id: consts.APIKEY_INTEGRATION_ID,
  name: "Google Cloud Platform ApiKey",
  description: "A third-party integration for the Google Cloud Platform utilizing an API key, for use with the Google Cloud TTS revised effects",
  connectionToggle: true,
  linkType: "id",
  idDetails: {
    steps: `
            1. Visit the [Google Cloud Platform Credentials](https://console.cloud.google.com/apis/credentials) page.
            2. Switch to or verify that you're operating within your preferred Google Cloud project.
            3. Either:
              - Click <ins>SHOW KEY</ins> on a pre-existing API Key, ***OR*** . . .
              - Click <ins>+ CREATE CREDENTIALS</ins> at the top to create a new key.
            4. Paste the API Key below.
        `,
  },
  settingCategories: {
    connection: {
      title: "Connection Settings",
      sortRank: 1,
      settings: {
        referrer: {
          title: "HTTP Referrer",
          description: `(Optional) An HTTP-referer [sic] header to send along. This can (at best) enable billing isolation per client instance.`,
          type: "string",
          default: "",
        },
        userAgent: {
          title: "User Agent",
          description: `(Optional) An user-agent string to append to the end of the "Firebot/5.x.y firebot-gcp-tts/${consts.PLUGIN_VERSION}" user-agent that is sent out by default.`,
          type: "string",
          default: "",
        },
      },
    },
  },
};

interface ApiKeyIntegrationEvents extends IntegrationEvents {
  /** The referrer (http-referer [sic]) integration setting was changed. */
  referrerUpdate: (referrer?: string) => void;
  /** The user agent integration setting was changed. */
  userAgentUpdate: (userAgent?: string) => void;
};

class IntegrationEventEmitter extends TypedEmitter<ApiKeyIntegrationEvents> { };

class ApikeyIntegrationController extends IntegrationEventEmitter implements BetterIntegrationController<ApiKeyParams> {
  connected = false;
  private _isConfigured = false;
  // We can't actually unregister any integrations when a third-party script is unloaded...
  private _isScriptLoaded = false;

  constructor(modules: ScriptModules) {
    super();
    modules.frontendCommunicator.on("gcpttsIsApikeyIntegrationConfigured",
      () => {
        return this._isConfigured;
      });
  }

  /** Returns a value indicating whether or not the integrationData is considered valid. */
  private static _checkConfig(integrationData?: IntegrationData<ApiKeyParams>): boolean {
    return integrationData != null && integrationData.accountId != null && integrationData.accountId.length >= 16;
  };

  private _setConnected(wantsConnection: boolean): boolean {
    const willBeConnected = wantsConnection && this._isConfigured;

    if (!this.connected && wantsConnection && this._isConfigured) {
      this.connected = willBeConnected;
      this.emit("connected", integrationDefinition.id);
    } else if (this.connected && (!wantsConnection || !this._isConfigured)) {
      this.connected = willBeConnected;
      this.emit("disconnected", integrationDefinition.id);
    }

    return this.connected;
  };
  private _setupConnection(integrationData?: IntegrationData<ApiKeyParams>): boolean {
    if (integrationData == null || integrationData.accountId == null || integrationData.accountId.length < 16) {
      this._isConfigured = false;
      this._setConnected(false);
    } else {
      this._isConfigured = true;
    }
    return this._isConfigured;
  };

  init(_linked: boolean, _integrationData: IntegrationData<ApiKeyParams>): void | PromiseLike<void> {
  };

  connect(integrationData: IntegrationData<ApiKeyParams>): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.integration.apiKey");
    if (!this._setupConnection(integrationData)) {
      logger.warn("Trying to connect() without being configured");
      this._setConnected(false);
      return;
    }

    if (this._setConnected(true)) {
      logger.debug("Connected to the Google Cloud Platform integration");
    } else {
      logger.warn("Failed to connect to the Google Cloud Platform integration");
    }
  };
  disconnect(): void | PromiseLike<void> {
    this._setConnected(false);
    const logger = new ContextLogger("gcptts.integration.apikey.disconnect");
    logger.debug("gcptts.integration.apiKey: Disconnected Google Cloud Platform integration");
  };
  isConfigured(): boolean {
    return this._isConfigured;
  };
  link(): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.integration.apikey.link");
    logger.debug("linked Google Cloud Platform integration");
  };
  unlink(): void | PromiseLike<void> {
    this._setConnected(false);
    const logger = new ContextLogger("gcptts.integration.apikey.unlink");
    logger.debug("Unlinked Google Cloud Platform integration");
  };
  onUserSettingsUpdate(integrationData: IntegrationData<ApiKeyParams>): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.integration.apikey.settingsUpdate");
    logger.debug("user settings updated");
    this._setupConnection(integrationData);
    this.emit("settings-update", integrationDefinition.id, integrationData);
  };
};

let apiKeyController: ApikeyIntegrationController | null = null;
export default {
  initialize: (modules: ScriptModules) => {
    apiKeyController ??= new ApikeyIntegrationController(modules);
  },

  integration(): Integration<ApiKeyParams> {
    if (!apiKeyController) {
      throw new Error("Unable to get integration, it has not been initialized");
    }
    return {
      definition: integrationDefinition,
      integration: apiKeyController,
    };
  }
};

// export default {
//   definition: integrationDefinition,
//   integration: customPlugin.modules.integrationManager.getIntegrationById(integrationDefinition.id)?.integration as ApikeyIntegrationController ?? new ApikeyIntegrationController(),
// };
