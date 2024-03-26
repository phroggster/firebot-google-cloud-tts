import { IntegrationWithUnknowns, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import axios from "axios";

import { logger } from "./logger";
import { EffectParams, GoogleCloud, VoiceInfo, VoiceSelectionParams } from "./types";

class GoogleCloudService implements GoogleCloud {
    constructor(
        private readonly frontendCommunicator: ScriptModules["frontendCommunicator"],
        private readonly integrationManager: ScriptModules["integrationManager"],
    ) {
        logger.debug("google-cloud-service: constructing");
    }

    /** Returns the google cloud API key if it's available and the integration is connected, or null if it isn't. */
    private _getApiKey(integration: IntegrationWithUnknowns): string | null {
        if (integration?.definition?.accountId == null
            || integration.definition.accountId.length < 20
            || !integration.integration.connected)
        {
            return null;
        }

        return integration.definition.accountId;
    }

    validateEffects(effects?: Array<string>): boolean | PromiseLike<boolean> {
        if (effects !== null && (effects?.length ?? 0) > 0) {
            const allowedDeviceProfiles = [
                "wearable-class-device",
                "handset-class-device",
                "headphone-class-device",
                "small-bluetooth-speaker-class-device",
                "medium-bluetooth-speaker-class-device",
                "large-home-entertainment-class-device",
                "large-automotive-class-device",
                "telephony-class-application"
            ];
            const badDeviceProfiles = effects.filter((v) => {
                return allowedDeviceProfiles.indexOf(v) < 0;
            });
            if (badDeviceProfiles.length > 0) {
                logger.warn(`google-cloud-service.validateEffects: Unknown audio effect(s): ${badDeviceProfiles.join(", ")}`);
                return false;
            } else {
                logger.debug(`google-cloud-service.validateEffects: audio effects are set and valid, enabling ${effects.length} effects`);
            }
        }
        return true;
    }

    async listVoices(languageCodeParam?: string): Promise<Array<VoiceInfo> | undefined> {
        {
            const param = languageCodeParam == null ? "(null)" : languageCodeParam.length < 1 ? "(empty)" : languageCodeParam;
            logger.debug(`google-cloud-service.listVoices: initiating request, languageCodeParam: "${param}"`);
        }

        const gcpIntegration = this.integrationManager.getIntegrationById("google-cloud-key");
        const apiKey = this._getApiKey(gcpIntegration);
        if (apiKey === null) {
            logger.warn("google-cloud-service.listVoices: The integration hasn't been configured or is offline.");
            return;
        }

        type ListVoicesResponse = {
            voices?: Array<VoiceInfo>
        }

        const url = `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`;
        if (languageCodeParam == null || languageCodeParam.length < 1) {
            const response = await axios.get<ListVoicesResponse>(url)
                .catch(err => {
                    logger.error("google-cloud-service.listVoices: Failed to get Google Cloud TTS voice list", err);
                    throw err;
                });
            logger.info(`gcp-listVoices: received ${response?.data?.voices?.length ?? 0} voice details`);
            return response?.data?.voices;
        }
        else {
            const response = await axios.get<ListVoicesResponse>(url, { params: { languageCode: languageCodeParam } })
                .catch(err => {
                    logger.error(`google-cloud-service.listVoices: Failed to get Google Cloud TTS voice list for language '${languageCodeParam}'`, err);
                    throw err;
                });
            logger.info(`google-cloud-service.listVoices: received ${response?.data?.voices?.length ?? 0} voice details`);
            return response?.data?.voices;
        }
    }

    async synthesizeSsml(ssmlToSynthesize: string, voiceParams: VoiceSelectionParams, effectParams?: EffectParams): Promise<string | undefined> {
        type SynthesizeTextResponse = {
            audioContent: string;
        }

        logger.debug(`google-cloud-service.synthesizeSsml: received request: ssmlToSynth: ${ssmlToSynthesize}, voiceParams: ${voiceParams}, effectParams: ${effectParams}`);
        const gcpIntegration = this.integrationManager.getIntegrationById("google-cloud-key");
        const apiKey = this._getApiKey(gcpIntegration);
        if (apiKey === null) {
            logger.warn("google-cloud-service.synthesizeSsml: The integration hasn't been configured or is offline.");
            return;
        }

        if (!this.validateEffects(effectParams?.effects)) {
            effectParams.effects = [];
        }

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        const response = await axios.post<SynthesizeTextResponse>(url, {
            input: {
                ssml: ssmlToSynthesize
            },
            voice: {
                languageCode: voiceParams.language,
                name: voiceParams.name
            },
            audioConfig: {
                audioEncoding: "MP3",
                pitch: effectParams?.pitch ?? 0.0,
                speakingRate: effectParams?.rate ?? 1.0,
                volumeGainDb: effectParams?.volume ?? 0.0,
                effectsProfileId: effectParams?.effects ?? []
            }
        }).catch(err => {
            logger.error("google-cloud-service.synthesizeSsml: Failed to request Google Cloud text-to-speech ssml synthesis", err);
            throw err;
        });

        return response?.data?.audioContent;
    }

    async synthesizeText(textToSynthesize: string, voiceParams: VoiceSelectionParams, effectParams?: EffectParams): Promise<string | undefined> {
        type SynthesizeTextResponse = {
            audioContent: string;
        }

        logger.debug("google-cloud-service.synthesizeText: received synthesizeText request...");
        const gcpIntegration = this.integrationManager.getIntegrationById("google-cloud-key");
        const apiKey = this._getApiKey(gcpIntegration);
        if (apiKey == null || apiKey.length < 20) {
            logger.warn("google-cloud-service.synthesizeText: The integration hasn't been configured or is offline.");
            return;
        }

        if (effectParams !== null && !this.validateEffects(effectParams.effects)) {
            logger.warn("google-cloud-service.synthesizeText: effectParams contained invalid entries. Cleaning up.")
            effectParams.effects = [];
        }

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        let response = undefined;
        try {
            response = await axios.post<SynthesizeTextResponse>(url, {
                input: {
                    text: textToSynthesize
                },
                voice: {
                    languageCode: voiceParams.language,
                    name: voiceParams.name
                },
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: effectParams?.pitch ?? 0.0,
                    speakingRate: effectParams?.rate ?? 1.0,
                    volumeGainDb: effectParams?.volume ?? 0.0,
                    effectsProfileId: effectParams?.effects ?? []
                }
            });
        }
        catch (err) {
            logger.error("google-cloud-service.synthesizeText: unable to sythesize text", err);
            return;
        }

        return response?.data?.audioContent;
    }
};

export let googleCloudService: GoogleCloud = null;

export function initGoogleCloudService(modules: ScriptModules): void {
    logger.info("google-cloud-service: Initializing Google Cloud Platform service.");

    googleCloudService = new GoogleCloudService(modules.frontendCommunicator, modules.integrationManager);
};
