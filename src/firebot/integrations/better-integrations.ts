import { Integration, IntegrationController, IntegrationData, IntegrationDefinition, IntegrationEvents, LinkData, ObjectOfUnknowns } from "@crowbartools/firebot-custom-scripts-types";
import { FirebotParameterCategories, FirebotParams } from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { TypedEmitter } from "tiny-typed-emitter";

export type BetterIntegrationDefinition<TParams extends FirebotParams = FirebotParams> = {
  id: string;
  name: string;
  description: string;
  configurable?: boolean;
  connectionToggle?: boolean;
  settingCategories: FirebotParameterCategories<TParams>;
} & (
  | {
    linkType: "id";
    idDetails: {
      steps: string;
    };
  }
  | {
    linkType: "auth";
    authProviderDetails: {
      id: string;
      name: string;
      redirectUriHost?: string;
      client: {
        id: string;
        secret: string;
      };
      auth: {
        tokenHost: string;
        tokenPath: string;
        authorizePath: string;
      };
      autoRefreshToken?: boolean;
      // TODO: string array needs added to @crowbartools/firebot-custom-scripts-types
      scopes: string | string[];
    };
  }
  | { linkType: "other" | "none" }
);

export type BetterIntegrationManager = {
  getAllIntegrationDefinitions(): IntegrationDefinition[];
  getIntegrationById(integrationId: string): BetterIntegrationDefinition;
  getIntegrationDefinitionById(
    integrationId: string
  ): (IntegrationDefinition & ObjectOfUnknowns) | null;
  integrationIsConnectable(integrationId: string): boolean;
  registerIntegration(integration: Integration): void;
};

// this is just here for now for commentary

export type BetterIntegrationController<TParams extends FirebotParams = FirebotParams> = IntegrationController<TParams> & TypedEmitter<IntegrationEvents> & {
  /** Whether or not the integration is connected. */
  connected: boolean;

  /**
   * Invoked shortly after the integration has been registered.
   * @param linked `true` if the integration has been connected before, `false` otherwise.
   * @param integrationData The integration settings data.
   */
  init(
    linked: boolean,
    integrationData: IntegrationData<TParams>,
  ): void | PromiseLike<void>;

  /** Invoked when the controller needs to connect, if at all possible. */
  connect?(
    integrationData: IntegrationData<TParams>,
  ) : void | PromiseLike<void>;
  /** Invoked when the controller needs to disconnect. */
  disconnect?(): void | PromiseLike<void>;
  /**
   * * Invoked when the integration is asked to link up. Throw an Error in here if it needs to be stopped.
   * @param linkData Data required to link the integration.
   */
  link?(linkData: LinkData): void | PromiseLike<void>;
  /** Invoked when the user changes the integration's parameters. */
  onUserSettingsUpdate?(
    integrationData: IntegrationData<TParams>,
  ): void | PromiseLike<void>;
};
