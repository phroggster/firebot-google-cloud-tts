import { Integration, IntegrationController, IntegrationDefinition, IntegrationData, IntegrationEvents, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { FirebotParams } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { TypedEmitter } from "tiny-typed-emitter";

import { consts } from "./consts";
import { logger } from "./logger";

// TODO: replace/enhance this with OAuth (linkType: "auth") once flow endpoints can be split over differing servers.
// As-is, `{ auth: { authorizePath, tokenPath } }` rely on appending to the same `tokenHost`, while Google Cloud needs
// { authorizePath: https://accounts.google.com/o/oauth2/v2/auth, tokenPath: https://www.googleapis.com/oauth2/v4/token }
// Then there's some additional complexity in requiring end-users to supply their own OAuth client-id and client-secret values.

/*
import ClientOAuth2 from "client-oauth2";
import { EventManager } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import { Gcloud } from "./google-api.old";
import { GoogleTTSEffectType } from "./google-tts-effect"

 We can't code client id nor secret in (event using the secrets API), it *has* to be provided by the end-user.
 And the oauth API doesn't seem to want to allow authEndpoint and tokenEndpoint to be on differing services.

const oauthConfig = {
    clientId: "",
    clientSecret: "",
    authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://www.googleapis.com/oauth2/v4/token",
    userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: "https://www.googleapis.com/auth/cloud-platform",
};
type OauthKey = {
    accessToken: string,
    allowedScopes?: string,
    refreshToken: string,
};

export type IntegrationSettings = {
    authSettings: {
        //mode: string,
        apiKey: string,
        //clientId: string,
        //clientSecret: string,
    },
    connectionSettings: {
        autoConnect: boolean
    },
};
*/

const integrationDefinition: IntegrationDefinition<FirebotParams> = {
    id: consts.INTEGRATION_ID,
    name: "Google Cloud Platform",
    description: "Google Cloud Platform integration, for use with the Text to Speech API",
    connectionToggle: true,
    linkType: "id",
    idDetails: {
        steps: `
1. Visit the [Google Cloud Platform Credentials](https://console.cloud.google.com/apis/credentials) page for your project.
2. Either:
  - Click <ins>SHOW KEY</ins> on a pre-existing API Key, ***OR*** . . .
  - Click <ins>+ CREATE CREDENTIALS</ins> at the top to create a new key.
3. Paste the API Key below.`
    },
    settingCategories: null
};

class IntegrationEventEmitter extends TypedEmitter<IntegrationEvents> { };

class GoogleIntegration
    extends IntegrationEventEmitter
    implements IntegrationController {
    connected = false;
    private _isConfigured = false;

    constructor(
        private readonly frontendCommunicator: ScriptModules["frontendCommunicator"],
    ) {
        super();
        this.connected = false;
        this.frontendCommunicator.on(
            "google-cloud-is-configured",
            () => this._isConfigured
        );
    }

    private _checkConfig(integrationData: IntegrationData): boolean { 
        let { accountId } = integrationData;
        if (accountId === null || accountId.length < 20) {
            this._isConfigured = false;
        }
        else {
            this._isConfigured = true;
        }
        return this._isConfigured;
    }
    private _setConnected(wantsConnection: boolean): boolean {
        const connected = wantsConnection && this._isConfigured;
        if (connected) {
            this.emit("connected", integrationDefinition.id);
        } else {
            this.emit("disconnected", integrationDefinition.id);
        }
        this.connected = connected;
        return connected;
    };

    init(): void | PromiseLike<void> {
    }
    connect(integrationData: IntegrationData): void | PromiseLike<void> {
        if (!this._checkConfig(integrationData)) {
            logger.warn("google-integration: Trying to connect() without being configured");
            this._setConnected(false);
            return;
        }

        if (this._setConnected(true)) {
            logger.debug("google-integration: Connected to the Google Cloud Platform integration");
        } else {
            logger.warn("google-integration: Failed to connect to the Google Cloud Platform integration");
        }
    }
    disconnect(): void | PromiseLike<void> {
        this._setConnected(false);
        logger.debug("google-integration: Disconnected Google Cloud Platform integration");
    }
    link(): void | PromiseLike<void> {
        logger.debug("google-integration: Linked Google Cloud Platform integration");
    };
    unlink(): void | PromiseLike<void> {
        this._setConnected(false);
        logger.debug("google-integration: Unlinked Google Cloud Platform integration");
    };
    onUserSettingsUpdate(integrationData: IntegrationData): void | PromiseLike<void> {
        if (!this._checkConfig(integrationData)) {
            logger.warn("google-integration.onUserSettingsUpdate: User settings updated, but an invalid API Key was provided.");
            this._setConnected(false);
            return;
        }
        logger.debug("google-integration: User settings updated");
    };
};

export let googleCloudIntegration: Integration = null;

export function initGoogleCloudPlatformIntegration(
    modules: ScriptModules
) {
    const { frontendCommunicator, integrationManager } = modules;
    logger.info("google-integration: Initializing Google Cloud Platform apiKey integration");

    googleCloudIntegration = {
        definition: (integrationDefinition as any),
        integration: new GoogleIntegration(frontendCommunicator)
    };
    modules.integrationManager.registerIntegration(googleCloudIntegration);
};
