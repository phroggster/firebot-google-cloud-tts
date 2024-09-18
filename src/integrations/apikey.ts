import {
    IntegrationController,
    IntegrationDefinition,
    IntegrationData,
    IntegrationEvents
} from "@crowbartools/firebot-custom-scripts-types";
import { FirebotParams } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { TypedEmitter } from "tiny-typed-emitter";

import consts from "../consts";
import { getScriptController } from "../main";
import { ContextLogger } from "../context-logger";

const logger = new ContextLogger("gcptts.integrations.apiKey");;

const integrationDefinition: IntegrationDefinition<FirebotParams> = {
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
        `
    },
    settingCategories: null
};

interface ApiKeyIntegrationEvents extends IntegrationEvents {
    "referrer-update": (referrer?: string) => void;
};

class IntegrationEventEmitter extends TypedEmitter<ApiKeyIntegrationEvents> { };

class ApikeyIntegrationController
    extends IntegrationEventEmitter
    implements IntegrationController
{
    connected = false;
    private _isConfigured = false;
    // We can't actually unregister any integrations when a third-party script is unloaded...
    private _isScriptLoaded = false;

    constructor() {
        super();
        const controller = getScriptController();
        controller.on("loaded",
            () => {
                this._isScriptLoaded = true;
            });
        controller.on("unloading",
            () => {
                this._isScriptLoaded = false;
                this._setConnected(false);
            });
        controller.modules.frontendCommunicator.on("google-cloud-is-configured",
            () => this._isScriptLoaded && this._isConfigured
        );
    };

    private _checkConfig(integrationData: IntegrationData): boolean {
        const { accountId } = integrationData;
        if (accountId === null || accountId.length < 20) {
            this._isConfigured = false;
        }
        else {
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

    init(): void | PromiseLike<void> {

    }
    connect(integrationData: IntegrationData): void | PromiseLike<void> {
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
        logger.debug("Disconnected Google Cloud Platform integration");
    }
    link(): void | PromiseLike<void> {
        logger.debug("Linked Google Cloud Platform integration");
    };
    unlink(): void | PromiseLike<void> {
        this._setConnected(false);
        logger.debug("Unlinked Google Cloud Platform integration");
    };
    onUserSettingsUpdate(integrationData: IntegrationData): void | PromiseLike<void> {
        if (!this._checkConfig(integrationData)) {
            logger.warn(`integration settings updated, but an empty or invalid API Key was supplied.`);
            this._setConnected(false);
            return;
        }

        logger.debug("User settings updated");
    };
};

export default {
    definition: integrationDefinition,
    integration: getScriptController().modules.integrationManager.getIntegrationById(integrationDefinition.id)?.integration ?? new ApikeyIntegrationController()
};
