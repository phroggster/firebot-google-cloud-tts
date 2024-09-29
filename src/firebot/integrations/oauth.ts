import {
  IntegrationController,
  IntegrationDefinition,
  IntegrationData,
  IntegrationEvents,
} from "@crowbartools/firebot-custom-scripts-types";
import { FirebotParams } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import ClientOAuth2 from "client-oauth2";
import { TypedEmitter } from "tiny-typed-emitter";

import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";

// TODO: none of this works, and much still needs to be implements. No peeking.

interface OAuthParams extends FirebotParams {
  connection: {
    /** Required. The OAuth 2.0 client id, which is handled through the integration's UI. */
    clientId: string,
    /** Required. The OAuth 2.0 client secret, which is handled through the integration's UI. */
    clientSecret: string,
    /**
     * Optional, required for "Web application" flows. An HTTP-referer [sic] to supply with web requests from this
     * integration. This can enable tighter control of accepted credentials over the "Desktop application" flow.
     */
    referrer: string;
    /**
     * Optional. An user-agent string to append onto the "Firebot/{fb version} firebot-gcp-tts/{plugin version}" that
     * we supply by default. User agents aren't seemingly tracked in the GCP text-to-speech API by default, unless you
     * hook up additional monitoring APIs in the GCP console or perhaps do long-form TTS requests.
     *
     * This does not add any additional security, it adds *at best* client instance billing isolation.
     */
    userAgent: string;
  },
};

const integrationDefinition: IntegrationDefinition<OAuthParams> = {
  id: consts.OAUTH2_INTEGRATION_ID,
  name: "Google Cloud Platform OAuth 2.0",
  description: "A third-party integration for the Google Cloud Platform utilizing a OAuth 2.0, for use with the Google Cloud TTS revised effects",
  connectionToggle: true,
  linkType: "other",
  // linkType: "auth",
  // authProviderDetails: {
  //   id: "",
  //   name: "",
  //   redirectUriHost: undefined,
  //   client: {
  //     id: "",
  //     secret: "",
  //   },
  //   auth: {
  //     // TODO: easy PR; authorizeHost isn't exposed by firebot-custom-scripts-types for an "auth" linkType
  //     authorizeHost: "https://accounts.google.com",
  //     authorizePath: "/o/oauth2/v2/auth", // "/device/code"
  //     tokenHost: "https://oauth2.googleapis.com",
  //     tokenPath: "/token",
  //   },
  //   // TODO: easy PR; this can be an array, but is exposed only as a space-separated string by firebot-custom-scripts-types
  //   scopes: "https://www.googleapis.com/auth/cloud-platform",
  // },
  settingCategories: {
    connection: {
      title: "Connection Settings",
      sortRank: 1,
      settings: {
        clientId: {
          title: "OAuth Client ID",
          description: "The Client ID, visible in the [Credentials](https://console.cloud.google.com/apis/credentials) page for your cloud project",
          type: "string",
          default: "",
        },
        clientSecret: {
          title: "Client Secret",
          description: "The Client Secret listed in the TTS project's Credentials page",
          type: "password",
          default: "",
        },
        referrer: {
          title: "HTTP Referrer",
          description: `(Optional) An HTTP-referer [sic] header to send along. If your credentials page shows an "Authorized JavaScript origins" section (i.e. a "Web application" type, not a "Desktop" type), this must match an entry in that list.`,
          type: "string",
          default: "",
        },
        userAgent: {
          title: "User Agent",
          description: `(Optional) A user-agent string to append to the end of the "Firebot/5.x.y firebot-gcp-tts/${consts.PLUGIN_VERSION}" user-agent that is supplied by default.`,
          type: "string",
          default: "",
        },
      },
    },
  },
};

interface OAuthIntegrationEvents extends IntegrationEvents {
  /** The referrer (http-referer [sic]) integration setting was changed. */
  referrerUpdate: (referrer?: string) => void;
  /** The user agent integration setting was changed. */
  userAgentUpdate: (userAgent?: string) => void;
};

class OauthIntegrationEventEmitter extends TypedEmitter<OAuthIntegrationEvents> { };


class OAuthIntegrationController extends OauthIntegrationEventEmitter implements IntegrationController {
  connected = false;
  private _httpPort: number = 7472;
  private _isConfigured = false;

  private _checkConfig(integrationData: IntegrationData): boolean {
    const { accountId } = integrationData;
    if (!accountId || accountId.length < 16) {
      this._isConfigured = false;
    } else {
      this._isConfigured = true;
    }
    return this._isConfigured;
  }
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
  private _setupConnection(integrationData: IntegrationData<OAuthParams>): boolean {
    if (!integrationData || !integrationData.userSettings || !integrationData.userSettings?.connection.clientId) {
      this._isConfigured = false;
      this._setConnected(false);
    } else {
        // TODO: I don't know if I even like this path
    }

    return this._isConfigured;
  }

  init(): void | PromiseLike<void> {
    const { firebotSettings, frontendCommunicator} = customPlugin;

    this._httpPort = firebotSettings.getWebServerPort();
    frontendCommunicator.on("gcpttsIsOauthIntegrationConfigured",
      () => {
        return this._isConfigured;
      });
  }

  connect(integrationData: IntegrationData): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.integration.oauth");
    if (!this._checkConfig(integrationData)) {
      logger.warn("Trying to connect() without being configured");
      this._setConnected(false);
      return;
    }

    if (this._setConnected(true)) {
      logger.debug("Connected to the Google Cloud Platform integration");
    } else {
      logger.warn("Failed to connect to the Google Cloud Platform integration");
    }
  }
  disconnect(): void | PromiseLike<void> {
    this._setConnected(false);
    customPlugin.logger.debug("gcptts.integration.oauth: Disconnected Google Cloud Platform integration");
  }
  isConfigured(): boolean {
    return this._isConfigured;
  };
  link(): void | PromiseLike<void> {
    customPlugin.logger.debug("gcptts.integration.oauth: inked Google Cloud Platform integration");
  };
  unlink(): void | PromiseLike<void> {
    this._setConnected(false);
    customPlugin.logger.debug("gcptts.integration.oauth: Unlinked Google Cloud Platform integration");
  };
  onUserSettingsUpdate(integrationData: IntegrationData): void | PromiseLike<void> {
    if (!this._checkConfig(integrationData)) {
      customPlugin.logger.warn(`gcptts.integration.oauth: integration settings updated, but an empty or invalid API Key was supplied.`);
      this._setConnected(false);
      return;
    }

    customPlugin.logger.debug("gcptts.integration.oauth: settings updated");
  };
};

export default {
  definition: integrationDefinition,
  integration: customPlugin.modules.integrationManager.getIntegrationById(integrationDefinition.id)?.integration as OAuthIntegrationController ?? new OAuthIntegrationController(),
};
