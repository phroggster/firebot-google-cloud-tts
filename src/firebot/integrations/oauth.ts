import {
  Integration,
  IntegrationController,
  IntegrationEvents,
} from "@crowbartools/firebot-custom-scripts-types";
import { TypedEmitter } from "tiny-typed-emitter";

import {
  BetterIntegrationData,
  BetterIntegrationDefinition,
} from "./better-integrations";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";
import { BaseGcpIntegrationParams } from "../../types";

// The OAuth 2 Firebot to Google Cloud Platform integration. Hard to setup,
// hard to use, hard to troubleshoot. Requests using this integration add an
// "Authorization: Bearer {ACCESS_TOKEN}" header to https requests.
//
// TODO: none of this works, and much still needs to be implemented. No peeking
// while the elves are working.

interface Params extends BaseGcpIntegrationParams {
  connection: {
    /** Required. The OAuth 2.0 client id, which is handled through the
     * integration's UI.
     */
    clientId: string,
    /** Optional. The OAuth 2.0 client secret, which is handled through the
     * integration's UI.
     */
    clientSecret?: string,
    /** Optional. The OAuth 2.0 authorization flow utilized. (Don't think I
     * care about this, just force device flow?)
     */
    //method?: "code" | "device" | "token";
    /** Optional, ?maybe? required for "Web application" OAuth flows. An HTTP
     * referer [*sic*] header can limit requests accepted from the credentials.
     * This can enable some tighter control of credentials over the
     * "Desktop application" OAuth flow.
     */
    referrer?: string,
    /** Optional. An user-agent string to append onto the
     * "Firebot/{fb version} firebot-gcp-tts/{plugin version}" that is
     * supplied. User agents aren't seemingly tracked in the GCP text-to-speech
     * API by default, unless you hook up additional monitoring APIs in the GCP
     * console, or perhaps do long-form TTS requests.
     *
     * This does not add any additional security, it adds *at best* client
     * instance billing isolation.
     */
    userAgent?: string,
  },
};
interface RefreshAuthResponse {
  access_token: string,
  expires_in: number,
  id_token: string,
  refresh_token?: string | null,
  scope: string | string[],
  token_type: string,
};

const integrationDefinition: BetterIntegrationDefinition<Params> = {
  id: consts.OAUTH2_INTEGRATION_ID,
  name: "Google Cloud Platform OAuth",
  description: "A third-party integration for the Google Cloud Platform\
 utilizing a OAuth 2.0, for use with the Google Cloud TTS revised effects",
  connectionToggle: true,
  linkType: "auth",
  authProviderDetails: {
    id: consts.OAUTH2_AUTHPROVIDER_ID,
    name: "Google Cloud Platform",
    redirectUriHost: undefined,
    auth: {
      authorizeHost: "https://accounts.google.com",
      authorizePath: "/o/oauth2/v2/auth", // "/device/code"
      tokenHost: "https://oauth2.googleapis.com",
      tokenPath: "/token",
      type: "device",
    },
    client: {
      id: null,
      secret: undefined,
    },
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  },
  settingCategories: {
    connection: {
      title: "Connection Settings",
      sortRank: 1,
      settings: {
        clientId: {
          title: "OAuth Client ID",
          description: "The Client ID, visible in the\
 [Credentials](https://console.cloud.google.com/apis/credentials) page for\
 your cloud project",
          type: "string",
          default: "",
        },
        clientSecret: {
          title: "Client Secret",
          description: "The Client Secret listed in the TTS project's\
 Credentials page",
          type: "password",
          default: "",
        },
        referrer: {
          title: "HTTP Referrer",
          description: `(Optional) An HTTP-referer [sic] header to send along.\
 If your credentials page shows an "Authorized JavaScript origins" section\
 (i.e. a "Web application" type, not a "Desktop" type), this must match an\
 entry in that list.`,
          type: "string",
          default: "",
        },
        userAgent: {
          title: "User Agent",
          description: `(Optional) A user-agent string to append to the end of\
 the "Firebot/5.x.y firebot-gcp-tts/${consts.PLUGIN_VERSION}" user-agent that\
 is supplied by default.`,
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

class OAuthIntegrationEventEmitter extends TypedEmitter<
  OAuthIntegrationEvents
> {
};


class OAuthIntegrationController
  extends OAuthIntegrationEventEmitter
  implements IntegrationController<Params>
  // eslint-disable-next-line brace-style
{
  connected = false;
  authData?: BetterIntegrationData<Params> = undefined;
  private _definition?: BetterIntegrationDefinition<Params> = undefined;
  private _isConfigured = false;
  // We can't actually unregister any integrations when a third-party script
  // gets unloaded...
  private _isScriptLoaded = false;

  private _checkConfig(
    integrationData: BetterIntegrationData<Params>,
  ): boolean {
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
  private _setupConnection(
    integrationData: BetterIntegrationData<Params>,
  ): boolean {
    if (!integrationData || !integrationData.userSettings ||
      !integrationData.userSettings?.connection.clientId
    ) {
      this._isConfigured = false;
      this._setConnected(false);
    } else {
      // TODO: I don't know if I even like this path
    }

    return this._isConfigured;
  }

  init(
    _linked: boolean,
    integrationData: BetterIntegrationData<Params>,
  ): void | PromiseLike<void> {
    const { frontendCommunicator } = customPlugin;

    this.authData = integrationData;
    frontendCommunicator.on("gcpttsIsOauthIntegrationConfigured",
      () => {
        return this._isConfigured;
      });
  }

  connect(
    integrationData: BetterIntegrationData<Params>,
  ): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.oauth");
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
    customPlugin.logger.debug("gcptts.oauth: Disconnected Google Cloud Platform\
 integration");
  }

  isConfigured(): boolean {
    return this._isConfigured;
  };

  link(): void | PromiseLike<void> {
    customPlugin.logger.debug("gcptts.oauth: inked Google Cloud Platform\
 integration");
  };

  unlink(): void | PromiseLike<void> {
    this._setConnected(false);
    customPlugin.logger.debug("gcptts.oauth: Unlinked Google Cloud\
 Platform integration");
  };

  onUserSettingsUpdate(
    integrationData: BetterIntegrationData<Params>,
  ): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.oauth");
    if (!this._checkConfig(integrationData)) {
      this._setConnected(false);
      return;
    }

    logger.debug("settings updated");
  };

  private async _refreshToken(): Promise<string | null> {
    if (!this._definition || this._definition.linkType !== "auth" ||
      !this.authData || !this._definition.authProviderDetails
    ) {
      return null;
    }
    const logger = new ContextLogger("gcptts.oauth.refresh");

    try {
      const provider = this._definition.authProviderDetails;
      const url = `${provider.auth.tokenHost}${provider.auth.tokenPath}`;

      const requestHeaders = new Headers({
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": customPlugin.settingsProvider.userAgent,
      });
      if (this.authData.userSettings?.connection.referrer) {
        requestHeaders.append("Referer",
          this.authData.userSettings.connection.referrer);
      }

      const response = await fetch(url, {
        body: encodeURIComponent(`grant_type=refresh_token&client_id=\
${provider.client.id}${(provider.client.secret ? `&client_secret=\
${provider.client.secret}` : "")}&refresh_token=${this.authData.oauth.req}`),
        headers: requestHeaders,
        method: "POST",
      });

      if (response.status === 200) {
        const { integrationManager } = customPlugin;
        const integration = integrationManager.getIntegrationById<Params>(
          consts.OAUTH2_INTEGRATION_ID);
        const responseData = await response.json() as RefreshAuthResponse;

        logger.debug(`Got a refresh token of\
 ${responseData.access_token.length} characters, attempting to persist it now`);
        integrationManager.saveIntegrationAuth(integration, {
          ...responseData,
          // eslint-disable-next-line camelcase
          refresh_token: this.authData.oauth.refresh_token,
        });
        return responseData.access_token;
      }
    } catch (err) {
      logger.errorEx("Unable to refresh token", err as Error);
    }
    return null;
  }
};

let gcpOAuthController: OAuthIntegrationController | null = null;
export default <Integration<Params>> {
  definition: integrationDefinition,
  integration: gcpOAuthController ??= new OAuthIntegrationController(),
};
