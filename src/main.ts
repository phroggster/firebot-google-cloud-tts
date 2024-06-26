import { Firebot } from "@crowbartools/firebot-custom-scripts-types";

import { initGoogleCloudService } from "./google-cloud-service";
import { initGoogleCloudPlatformIntegration } from "./google-integration";
import { initGoogleTtsEffectType } from "./google-tts-effect";
import { initLogger } from "./logger";
import { setTmpDir } from "./utils";

const script: Firebot.CustomScript = {
    getScriptManifest: () => {
        return {
            name: "Google Cloud TTS Effect",
            description: "Adds the Google Cloud TTS effect",
            author: "phroggie, heyaapl",
            version: "0.2.1",
            firebotVersion: "5",
            startupOnly: true,
            website: "https://github.com/phroggster/firebot-google-cloud-tts"
        };
    },
    getDefaultParameters: () => {
        return [];
    },
    run: (runRequest) => {
        // see src/backend/common/handlers/custom-scripts/custom-script-helpers.js:buildModules() for the full exported modules list.
        const path = runRequest.modules.path;
        setTmpDir(path.join(SCRIPTS_DIR, '..', '..', '..', '..', 'tmp', 'google-tts'));

        initLogger(runRequest.modules.logger);
        initGoogleCloudPlatformIntegration(runRequest.modules);
        initGoogleCloudService(runRequest.modules);
        initGoogleTtsEffectType(runRequest.modules, runRequest.firebot.settings);
    },
};

export default script;
