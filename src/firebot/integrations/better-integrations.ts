import {
  IntegrationController,
  IntegrationData,
  IntegrationEvents,
} from "@crowbartools/firebot-custom-scripts-types";
import {
  FirebotParameterCategories,
  FirebotParams,
// eslint-disable-next-line @stylistic/max-len
} from "@crowbartools/firebot-custom-scripts-types/types/modules/firebot-parameters";
import { TypedEmitter } from "tiny-typed-emitter";

// Divergence from ObjectOfUnknowns: `any`-> `unknown`
type ObjectOfAny = {
  [key: string]: unknown;
};

interface AuthProviderSettings {
  // TODO: easy PR; authorizeHost isn't exposed by firebot-custom-scripts-types
  authorizeHost?: string;
  authorizePath: string;
  tokenHost: string;
  tokenPath?: string;
  type: "code" | "token" | "device";
};
interface AuthProviderSettingsPriv extends ObjectOfAny {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string | string[];
  token_type?: string;
};
interface AuthProviderDetails {
  id: string,
  name: string,
  auth: AuthProviderSettings,
  // TODO: more easy PR; autoRefreshToken isn't listed in Firebot v5 auth.d.ts
  // AuthProviderDefinition, yet IntegrationManager.connectIntegration
  // references it
  autoRefreshToken?: boolean,
  client: {
    // Divergence: client ID isn't nullable elsewhere, but we need it to be
    // user-provided
    id: string | null,
    secret?: string,
  },
  redirectUriHost?: string,
  // TODO: string arrays are cool, firebot-custom-scripts-types plz
  scopes?: string[] | string;
};
type BaseIntegrationDefinition<TParams extends FirebotParams> = {
  description: string,
  id: string,
  name: string,
  settingCategories: FirebotParameterCategories<TParams>,

  configurable?: boolean,
  connectionToggle?: boolean,
};
type AuthIntegrationDefinition<
  TParams extends FirebotParams
> = BaseIntegrationDefinition<TParams> & {
  linkType: "auth";
  // Divergence: null needed here so we can have users provide their own client
  // id and/or secret.
  authProviderDetails: AuthProviderDetails | null;
}
type IdIntegrationDefinition<
  TParams extends FirebotParams
> = BaseIntegrationDefinition<TParams> & {
  linkType: "id",
  idDetails: {
    steps: string,
  },
};
type LameIntegrationDefinition<
  TParams extends FirebotParams
> = BaseIntegrationDefinition<TParams> & {
  linkType: "other" | "none",
};
export type BetterIntegrationDefinition<
  TParams extends FirebotParams = FirebotParams
> =
  LameIntegrationDefinition<TParams> |
  AuthIntegrationDefinition<TParams> |
  IdIntegrationDefinition<TParams>;

type AuthLinkData = ObjectOfAny & {
  auth?: AuthProviderSettings
    | AuthProviderSettingsPriv
    | (AuthProviderSettings & AuthProviderSettingsPriv) | null,
};
type IdLinkData = ObjectOfAny & {
  accountId?: string | null,
};
type BetterLinkData = IdLinkData | AuthLinkData | null;
export type BetterIntegrationData<
  TParams extends FirebotParams
> = IntegrationData<TParams> & {
  oauth?: AuthProviderSettings & AuthProviderSettingsPriv,
};

export type BetterIntegrationController<
  TParams extends FirebotParams = FirebotParams
> = IntegrationController<TParams> & TypedEmitter<IntegrationEvents> & {
  /** Whether or not the integration is connected. */
  connected: boolean;

  /**
   * Invoked shortly after the integration has been registered.
   * @param linked `true` if the integration has been connected before, `false`
   * otherwise.
   * @param integrationData The integration settings data.
   */
  init(
    linked: boolean,
    integrationData: BetterIntegrationData<TParams>,
  ): void | PromiseLike<void>;

  /** Invoked when the controller needs to connect, if at all possible. */
  connect?(
    integrationData: BetterIntegrationData<TParams>,
  ) : void | PromiseLike<void>;

  /** Invoked when the controller needs to disconnect. */
  disconnect?(): void | PromiseLike<void>;

  /** Invoked when the integration is asked to link up. Throw an Error in here
   * if it needs to be stopped.
   * @param linkData Data required to link the integration.
   */
  link?(linkData: BetterLinkData): void | PromiseLike<void>;

  /** Invoked when the user changes the integration's parameters. */
  onUserSettingsUpdate?(
    integrationData: BetterIntegrationData<TParams>,
  ): void | PromiseLike<void>;
};

type IntegrationControllerWithKnowns<
  TParams extends FirebotParams
> = BetterIntegrationController<TParams> & ObjectOfAny;
type IntegrationDefinitionWithKnowns<
  TParams extends FirebotParams
> = BetterIntegrationDefinition<TParams> & ObjectOfAny;
type IntegrationDefinitionWithUnknowns =
  IntegrationDefinitionWithKnowns<FirebotParams>;
type IntegrationWithKnowns<TParams extends FirebotParams> = {
  definition: IntegrationDefinitionWithKnowns<TParams>;
  integration: IntegrationControllerWithKnowns<TParams>;
}
type IntegrationWithUnknowns = IntegrationWithKnowns<FirebotParams>;

export type BetterIntegrationManager = {
  getAllIntegrationDefinitions(): IntegrationDefinitionWithUnknowns[];

  getIntegrationById<TParams extends FirebotParams = FirebotParams>(
    integrationId: string,
  ): IntegrationWithKnowns<TParams>;

  getIntegrationDefinitionById<TParams extends FirebotParams = FirebotParams>(
    integrationId: string,
  ): IntegrationDefinitionWithKnowns<TParams> | null;

  // Divergence: not exposed in FBCST's IntegrationManager
  getIntegrationUserSettings<TParams extends FirebotParams = FirebotParams>(
    integrationId: string,
  ): TParams | null;

  integrationIsConnectable(integrationId: string): boolean;

  registerIntegration(
    integration: IntegrationWithUnknowns,
  ): void;

  // Divergence: not exposed in FBCST's IntegrationManager
  saveIntegrationAuth<TParams extends FirebotParams = FirebotParams>(
    integration: IntegrationWithKnowns<TParams>,
    authData: AuthProviderSettings | AuthProviderSettingsPriv |
      (AuthProviderSettings & AuthProviderSettingsPriv),
  ): void;
};
