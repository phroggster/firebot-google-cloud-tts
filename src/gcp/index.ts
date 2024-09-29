import customPlugin from "../main";
import textToSpeech from "./text-to-speech";

class GoogleCloudApi {
  private _integrationIds: string[] = [];
  referrer?: string;
  userAgent?: string;

  get connectedIntegrations() {
    const integrationManager = customPlugin.integrationManager;
    return this._integrationIds
      .map(integration => integrationManager.getIntegrationById(integration))
      .filter(integration => integration.integration.connected);
  }

  get textToSpeech() {
    return textToSpeech;
  }

  addIntegration(integrationId: string) {
    const lCaseId = integrationId.toLowerCase();
    if (!this._integrationIds.some(intId => intId.toLowerCase() === lCaseId)) {
      this._integrationIds.push(integrationId);
    } else {
      customPlugin.logger.warn(`gcptts.gcp: Custom integration ${integrationId} has already been registered for use`);
    }
  }
}

const gcp = new GoogleCloudApi();
export default gcp;
