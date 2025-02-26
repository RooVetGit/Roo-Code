import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"

/**
 * Handles model-related webview messages
 */
export class ModelCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "requestOllamaModels":
				const ollamaModels = await provider.modelManager.getOllamaModels(message.text)
				provider.postMessageToWebview({ type: "ollamaModels", ollamaModels })
				break

			case "requestLmStudioModels":
				const lmStudioModels = await provider.modelManager.getLmStudioModels(message.text)
				provider.postMessageToWebview({ type: "lmStudioModels", lmStudioModels })
				break

			case "requestVsCodeLmModels":
				const vsCodeLmModels = await provider.modelManager.getVsCodeLmModels()
				provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
				break

			case "refreshGlamaModels":
				await provider.modelManager.refreshGlamaModels()
				break

			case "refreshOpenRouterModels":
				await provider.modelManager.refreshOpenRouterModels()
				break

			case "refreshOpenAiModels":
				if (message?.values?.baseUrl && message?.values?.apiKey) {
					const openAiModels = await provider.modelManager.getOpenAiModels(
						message?.values?.baseUrl,
						message?.values?.apiKey,
					)
					provider.postMessageToWebview({ type: "openAiModels", openAiModels })
				}
				break

			case "refreshUnboundModels":
				await provider.modelManager.refreshUnboundModels()
				break

			case "refreshRequestyModels":
				if (message?.values?.apiKey) {
					const requestyModels = await provider.modelManager.refreshRequestyModels(message?.values?.apiKey)
					provider.postMessageToWebview({ type: "requestyModels", requestyModels: requestyModels })
				}
				break
		}
	}
}
