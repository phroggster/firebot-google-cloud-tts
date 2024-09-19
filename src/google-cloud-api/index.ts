import { modules } from "../main";
import textToSpeech from "./text-to-speech";

class GoogleCloudApi {
  private _integrations: string[] = [];
  referrer?: string;
  userAgent?: string;

  get integrations() {
    if (modules === null || modules.integrationManager === undefined) {
      return [];
    }
    const integrationManager = modules.integrationManager;
    return this._integrations
      .map(integration => integrationManager?.getIntegrationById(integration))
      .filter(integration => integration.integration.connected);
  }

  get textToSpeech() {
    return textToSpeech;
  }

  addIntegration(integrationId: string) {
    const lcase = integrationId.toLowerCase();
    if (!this._integrations.some(intId => intId.toLowerCase() === lcase)) {
      this._integrations.push(integrationId);
    }
  }
}

const gcp = new GoogleCloudApi();
export default gcp;
