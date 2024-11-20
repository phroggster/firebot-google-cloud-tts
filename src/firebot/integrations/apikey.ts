import {
  Integration,
  IntegrationDefinition,
  IntegrationData,
  IntegrationEvents,
} from "@crowbartools/firebot-custom-scripts-types";
import { TypedEmitter } from "tiny-typed-emitter";

import { BetterIntegrationController } from "./better-integrations";
import consts from "../../consts";
import { ContextLogger } from "../../context-logger";
import customPlugin from "../../main";
import { BaseGcpIntegrationParams } from "../../types";

// The API Key Firebot to Google Cloud Platform integration.
//
// I strongly suggest adding your ISP's IP address range(s) to the "IP address
// restrictions block", or making use of the referrer and authorized web sites,
// and setting APIs solely to: ["Cloud Text-to-Speech", "Google Cloud APIs"] at
// https://console.cloud.google.com/apis/credentials
//
// API requests using this integration will add a
// "key={API_KEY}" query parameter to https requests.

interface Params extends BaseGcpIntegrationParams {
  connection: {
    /** Optional, maybe required for "Web application" OAuth flows. An HTTP
     * referer [*sic*] header can limit requests accepted from the credentials.
     * This can enable some tighter control of credentials over the "Desktop
     * application" OAuth flow.
     */
    referrer?: string;
    /** Optional. An user-agent string to append onto the "Firebot/{fb version}
     * firebot-gcp-tts/{plugin version}" that is supplied. User agents aren't
     * seemingly tracked in the GCP text-to-speech API by default, unless you
     * hook up additional monitoring APIs in the GCP console, or perhaps do
     * long-form TTS requests.
     *
     * This does not add any additional security, it adds *at best* client
     * instance billing isolation.
     */
    userAgent?: string;
  };
};

const integrationDefinition: IntegrationDefinition<Params> = {
  id: consts.APIKEY_INTEGRATION_ID,
  name: "Google Cloud Platform",
  description: "Enables Google Cloud Platform Text-To-Speech services.",
  connectionToggle: true,
  linkType: "id",
  idDetails: {
    steps: `
  1. Visit the [Google Cloud Platform Credentials](https://console.cloud.google.com/apis/credentials) page.
  2. Verify that you're looking at the *correct* Google Cloud project.
  3. Either:
    - Click <ins>SHOW KEY</ins> on a pre-existing API Key, ***OR*** . . .
    - Click <ins>+ CREATE CREDENTIALS</ins> at the top to create a new key.
  4. Specify the the minimum-allowable IP addresses or websites, and APIs.
  5. Paste the API Key below.
    `,
  },
  settingCategories: {
    connection: {
      title: "Connection Settings",
      sortRank: 1,
      settings: {
        referrer: {
          title: "HTTP Referrer",
          description: "(Optional) An HTTP-referer header to send along. This\
 can be used to mimic an authorized website.",
          type: "string",
          default: "",
        },
        userAgent: {
          title: "User Agent",
          description: `(Optional) An user-agent string to append to the end of\
 the "Firebot/x.y.z firebot-gcp-tts/${consts.PLUGIN_VERSION}" user-agent that\
 is sent by default.`,
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

class ApikeyIntegrationController
  extends IntegrationEventEmitter
  implements BetterIntegrationController<Params>
  // eslint-disable-next-line brace-style
{
  connected = false;
  private _isConfigured = false;

  /** Returns a value indicating whether or not the integrationData is
   * considered valid.
   */
  private static _checkConfig(
    integrationData?: IntegrationData<Params>,
  ) : boolean {
    return integrationData != null
      && integrationData.accountId != null
      && integrationData.accountId.length >= 16;
  };

  private _setConfigured(isConfigured: boolean): boolean {
    this._isConfigured = isConfigured;
    if (!isConfigured) {
      this._setConnected(false);
    }
    return this._isConfigured;
  };
  private _setConnected(wantsConnection: boolean): boolean {
    const wasConnected = this.connected;
    const willBeConnected = wantsConnection && this._isConfigured;

    this.connected = willBeConnected;

    if (wasConnected !== willBeConnected) {
      if (willBeConnected) {
        this.emit("connected", integrationDefinition.id);
      } else {
        this.emit("disconnected", integrationDefinition.id);
      }
    }

    return this.connected;
  };
  private _setupConnection(integrationData?: IntegrationData<Params>): boolean {
    return this._setConfigured(ApikeyIntegrationController._checkConfig(
      integrationData));
  };

  init(
    linked: boolean,
    integrationData: IntegrationData<Params>,
  ): void | PromiseLike<void> {
    // TODO: undebugging
    const logger = new ContextLogger("gcptts.apikey.init");
    logger.debug("Initializing integration", { linked, integrationData });

    this._setupConnection(integrationData);
  };

  connect(
    integrationData: IntegrationData<Params>,
  ): void | PromiseLike<void> {
    if (this._setupConnection(integrationData)) {
      this._setConnected(true);
    }
  };

  disconnect(): void | PromiseLike<void> {
    this._setConnected(false);
  };

  isConfigured(): boolean {
    return this._isConfigured;
  };

  link(): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.apikey.link");
    logger.debug("linked Google Cloud Platform integration");
  };

  unlink(): void | PromiseLike<void> {
    this._setConnected(false);
    const logger = new ContextLogger("gcptts.apikey.unlink");
    logger.debug("Unlinked Google Cloud Platform integration");
  };

  onUserSettingsUpdate(
    integrationData: IntegrationData<Params>,
  ): void | PromiseLike<void> {
    const logger = new ContextLogger("gcptts.apikey.settingsUpdate");
    logger.debug("user settings updated");

    this._setupConnection(integrationData);
    this.emit("settings-update", integrationDefinition.id, integrationData);
  };
};

const apikeyController = new ApikeyIntegrationController();
export default <Integration<Params>> {
  definition: integrationDefinition,
  integration: apikeyController,
};
