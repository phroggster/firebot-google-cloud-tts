import { GoogleCloudError } from "./google-cloud-error";
import textToSpeech from "./text-to-speech";

import { ContextLogger } from "../context-logger";
import {
  BetterIntegrationData,
} from "../firebot/integrations/better-integrations";
import customPlugin from "../main";
import { BaseGcpIntegrationParams } from "../types";
import consts from "../consts";

// CONNECT, DELETE, HEAD, OPTIONS, PATCH, PUT, and TRACE are all left out, e.g.
// I'm lazy, but they're never actually needed?
type GetParams = {
  method: "GET"
}
type PostParams<T> = {
  body: T,
  method: "POST",
}
type FetchParams<T> = (GetParams | PostParams<T>) & {
  endpoint: string,
  service: "texttospeech",
  version: "v1" | "v1beta1",

  params?: string[],
  referrer?: string | null,
}
type ErrorResponse = {
  error: {
    code: number,
    message: string,
    status: string,
  },
};

let hasAttached: boolean = false;

/** A helper class for utilizing multiple Firebot integrations with the Google
 * Cloud Platform APIs.
 */
class GoogleCloudApiShim {
  private _integrationIds: string[] = [];

  /** Gets all integrations that are both presently connected and registered
   * with the Google Cloud Platform shim.
   */
  get connectedIntegrations() {
    const integrationManager = customPlugin.integrationManager;
    return this._integrationIds
      .map(integration => integrationManager
        .getIntegrationById<BaseGcpIntegrationParams>(integration),
      ).filter(integration => integration.integration.connected);
  }

  /** Get a value indicating whether any integrations are configured. */
  get isIntegrationConfigured() {
    const { integrationManager } = customPlugin;
    return this._integrationIds.length > 0
        && this._integrationIds.map(id => integrationManager
          .getIntegrationById(id).integration,
        ).some(controller => controller
          && typeof controller.isConfigured === "function"
          && controller.isConfigured());
  }

  /** Get a value indicating whether any integrations are connected. */
  get isIntegrationConnected() {
    const { integrationManager } = customPlugin;
    return this._integrationIds.length > 0
      && this._integrationIds.map(id => integrationManager
        .getIntegrationById(id).integration,
      ).some(controller => controller.connected);
  }

  /** Gets the Google Cloud Platform Text-To-Speech API. */
  get textToSpeech() {
    return textToSpeech;
  }

  /** Registers an integration identifier as capable of being used with the
   * Google Cloud Platform.
   * @param integrationId The integration identifier to enable for use with the
   * Google Cloud Platform.
   */
  addIntegration(integrationId: string) {
    const lCaseId = integrationId.toLowerCase();
    if (!this._integrationIds.some(intId => intId.toLowerCase() === lCaseId)) {
      this._integrationIds.push(integrationId);
    } else {
      const logger = new ContextLogger("gcptts.shim.addIntegration");
      logger.warn(`Integration ${integrationId} has already been registered`);
    }
  }

  /** A fetch wrapper tailored for the Google Cloud Platform API integrated
   * with Firebot's integration (credentials) manager.
   * @param fetchParams Information about which API to invoke, and how to invoke
   * it.
   * @throws {GoogleCloudError} The request was rejected by GCP for some reason.
   * @throws {Error} A body was provided for a GET request.
   * @throws {Error} No integrations are connected to service the request.
   */
  async fetch<TResponse = unknown, TBody = unknown> (
    fetchParams: FetchParams<TBody>,
  ): Promise<TResponse | null> | never {
    const logger = new ContextLogger("gcptts.shim.fetch");
    // TODO: remove/sanitize any debugging that *may* contain private data
    const insecureLogger = new ContextLogger("gcptts.shim.fetch.INSECURE");
    const integrationManager = customPlugin.integrationManager;
    const integrations = this.connectedIntegrations;
    const requestHeaders: Headers = new Headers({
      "Accept": "application/json",
    });
    const requestParams: string[] = fetchParams.params
      && fetchParams.params.length > 0 ? fetchParams.params : [];
    const { settingsProvider } = customPlugin;

    if ("body" in fetchParams) {
      requestHeaders.append("Content-Type", "application/json");
    }

    if (!integrations.some(integration =>
      integration.definition.linkType === "auth" ||
      integration.definition.linkType === "id")
    ) {
      throw new Error("No integrations are available to service the request");
    }

    let integrationReferrer: string | undefined = undefined;
    let integrationUserAgent: string | undefined = undefined;

    for (const integration of integrations) {
      const userSettings = integrationManager
        .getIntegrationUserSettings<BaseGcpIntegrationParams>(
          integration.definition.id,
        );

      if (integration.definition.linkType === "auth") {
        if ("authData" in integration.integration) {
          const authData = integration.integration.authData as
            BetterIntegrationData<BaseGcpIntegrationParams> | undefined;
          if (authData && authData.oauth && authData.oauth.token_type
            && authData.oauth.token
          ) {
            let tokTyp = `${authData.oauth.token_type}`;
            tokTyp = `${tokTyp.slice(0, 1).toUpperCase()}${tokTyp.slice(1)}`;
            requestHeaders.append("Authorization",
              `${tokTyp} ${authData.oauth.token}`);

            if (userSettings && userSettings.connection) {
              if (userSettings.connection.referrer) {
                integrationReferrer = userSettings.connection.referrer;
              }
              if (userSettings.connection.userAgent) {
                integrationUserAgent = userSettings.connection.userAgent;
              }
            }
            logger.debug(`Using OAuth integration, token type: ${tokTyp}`);
            insecureLogger.debug("Using OAuth integration:",
              { data: authData, settings: userSettings });
            break;
          } else {
            insecureLogger.warn("OAuth integration is connected but is missing\
 required auth data?", integration);
          }
        } else {
          insecureLogger.warn("OAuth integration is connected, but lacks auth\
 data?", integration);
        }
      } else if (integration.definition.linkType === "id") {
        if (userSettings && userSettings.connection) {
          if (userSettings.connection.referrer) {
            integrationReferrer = userSettings.connection.referrer;
          }
          if (userSettings.connection.userAgent) {
            integrationUserAgent = userSettings.connection.userAgent;
          }
        }
        if ("accountId" in integration.definition) {
          if (integration.definition.accountId) {
            requestParams.push(`key=${integration.definition.accountId}`);
            logger.debug("Using ApiKey integration:",
              { settings: userSettings });
            break;
          } else {
            insecureLogger.warn("ApiKey integration is connected, but account\
 ID is nullish?", integration);
          }
        } else {
          insecureLogger.warn("ApiKey integration is connected, but lacks\
 account ID", integration);
        }
      } else {
        logger.warn(`Unknown integration link type:\
 ${integration.definition.linkType}`);
      }
    }

    if (fetchParams.referrer) {
      requestHeaders.append("Referer",
        `${integrationReferrer} ${fetchParams.referrer}`);
    } else if (integrationReferrer) {
      requestHeaders.append("Referer", integrationReferrer);
    }
    if (integrationUserAgent) {
      requestHeaders.append("User-Agent",
        `${settingsProvider.userAgent} ${integrationUserAgent}`);
    } else {
      requestHeaders.append("User-Agent", settingsProvider.userAgent);
    }

    const queryParam: string = requestParams.length > 0
      ? `?${requestParams.map(rp => encodeURIComponent(rp)).join("&")}`
      : "";
    const url = new URL(`https://${fetchParams.service}.googleapis.com/${fetchParams.version}/${fetchParams.endpoint}${queryParam}`);
    // TODO: Do their API keys ever contain an ampersand? Eww, if so.
    const scrubbedUri = encodeURI(
      decodeURI(url.href).replace(/key=[^&]*/, "key=REDACTED"));

    logger.debug("Attempting to fetch URL", {
      method: fetchParams.method,
      headers: requestHeaders,
      url: scrubbedUri,
    });

    const response = await fetch(url, {
      ...("body" in fetchParams && { body: JSON.stringify(fetchParams.body) }),
      headers: requestHeaders,
      method: fetchParams.method,
    });

    const resultObject = await response.json();
    if (resultObject && "error" in resultObject) {
      throw new GoogleCloudError((resultObject as ErrorResponse).error);
    } else if (!response.ok) {
      throw new GoogleCloudError({
        code: response.status,
        message: `An unknown error occurred fetching ${scrubbedUri}`,
        status: response.statusText,
      });
    }

    return resultObject as TResponse ?? null;
  }

  /** Attaches various events needed by the GCP integrations shim. */
  init(): void {
    const { frontendCommunicator } = customPlugin;
    if (hasAttached) {
      return;
    }
    hasAttached = true;

    frontendCommunicator.on(consts.signals.isIntegrationConfigured, () => {
      return hasAttached && this.isIntegrationConfigured;
    });
    frontendCommunicator.on(consts.signals.isIntegrationConnected, () => {
      return hasAttached && this.isIntegrationConnected;
    });
    customPlugin.once("stopped", () => {
      hasAttached = false;
      this._integrationIds.splice(0, this._integrationIds.length);
    });
  }
}

const googleCloudApiShim = new GoogleCloudApiShim();
export default googleCloudApiShim;
