import {
	ApiConfiguration,
	ModelInfo,
	anthropicDefaultModelId,
	anthropicModels,
	bedrockDefaultModelId,
	bedrockModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	geminiDefaultModelId,
	geminiModels,
	mistralDefaultModelId,
	mistralModels,
	openAiModelInfoSaneDefaults,
	openAiNativeDefaultModelId,
	openAiNativeModels,
	vertexDefaultModelId,
	vertexModels,
	xaiDefaultModelId,
	xaiModels,
	vscodeLlmModels,
	vscodeLlmDefaultModelId,
	openRouterDefaultModelId,
	requestyDefaultModelId,
	glamaDefaultModelId,
	unboundDefaultModelId,
} from "@roo/shared/api"

import { vscode } from "@src/utils/vscode"
import { ExtensionMessage } from "@roo/shared/ExtensionMessage"
import { useQuery } from "@tanstack/react-query"

type RouterModels = Record<"openrouter" | "requesty" | "glama" | "unbound", Record<string, ModelInfo>>

export const getRouterModels = async () =>
	new Promise<RouterModels>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Router models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "routerModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.routerModels) {
					console.log("message.routerModels", message.routerModels)
					resolve(message.routerModels)
				} else {
					reject(new Error("No router models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestRouterModels" })
	})

export const useRouterModels = () => useQuery({ queryKey: ["routerModels"], queryFn: getRouterModels })

export const useSelectedModel = (apiConfiguration?: ApiConfiguration) => {
	const { data: routerModels, isLoading, isError } = useRouterModels()
	const provider = apiConfiguration?.apiProvider || "anthropic"
	const id = apiConfiguration ? getSelectedModelId({ provider, apiConfiguration }) : anthropicDefaultModelId
	const info = routerModels ? getSelectedModelInfo({ provider, id, apiConfiguration, routerModels }) : undefined
	return { provider, id, info, isLoading, isError }
}

function getSelectedModelId({ provider, apiConfiguration }: { provider: string; apiConfiguration: ApiConfiguration }) {
	switch (provider) {
		case "openrouter":
			return apiConfiguration.openRouterModelId ?? openRouterDefaultModelId
		case "requesty":
			return apiConfiguration.requestyModelId ?? requestyDefaultModelId
		case "glama":
			return apiConfiguration.glamaModelId ?? glamaDefaultModelId
		case "unbound":
			return apiConfiguration.unboundModelId ?? unboundDefaultModelId
		case "openai":
			return apiConfiguration.openAiModelId || ""
		case "ollama":
			return apiConfiguration.ollamaModelId || ""
		case "lmstudio":
			return apiConfiguration.lmStudioModelId || ""
		case "vscode-lm":
			return apiConfiguration?.vsCodeLmModelSelector
				? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
				: ""
		default:
			return apiConfiguration.apiModelId ?? anthropicDefaultModelId
	}
}

function getSelectedModelInfo({
	provider,
	id,
	apiConfiguration,
	routerModels,
}: {
	provider: string
	id: string
	apiConfiguration?: ApiConfiguration
	routerModels: RouterModels
}): ModelInfo {
	switch (provider) {
		case "openrouter":
			return routerModels.openrouter[id] ?? routerModels.openrouter[openRouterDefaultModelId]
		case "requesty":
			return routerModels.requesty[id] ?? routerModels.requesty[requestyDefaultModelId]
		case "glama":
			return routerModels.glama[id] ?? routerModels.glama[glamaDefaultModelId]
		case "unbound":
			return routerModels.unbound[id] ?? routerModels.unbound[unboundDefaultModelId]
		case "xai":
			return xaiModels[id as keyof typeof xaiModels] ?? xaiModels[xaiDefaultModelId]
		case "bedrock":
			// Special case for custom ARN.
			if (id === "custom-arn") {
				return { maxTokens: 5000, contextWindow: 128_000, supportsPromptCache: false, supportsImages: true }
			}

			return bedrockModels[id as keyof typeof bedrockModels] ?? bedrockModels[bedrockDefaultModelId]
		case "vertex":
			return vertexModels[id as keyof typeof vertexModels] ?? vertexModels[vertexDefaultModelId]
		case "gemini":
			return geminiModels[id as keyof typeof geminiModels] ?? geminiModels[geminiDefaultModelId]
		case "deepseek":
			return deepSeekModels[id as keyof typeof deepSeekModels] ?? deepSeekModels[deepSeekDefaultModelId]
		case "openai-native":
			return (
				openAiNativeModels[id as keyof typeof openAiNativeModels] ??
				openAiNativeModels[openAiNativeDefaultModelId]
			)
		case "mistral":
			return mistralModels[id as keyof typeof mistralModels] ?? mistralModels[mistralDefaultModelId]
		case "openai":
			return apiConfiguration?.openAiCustomModelInfo || openAiModelInfoSaneDefaults
		case "ollama":
			return openAiModelInfoSaneDefaults
		case "lmstudio":
			return openAiModelInfoSaneDefaults
		case "vscode-lm":
			const modelFamily = apiConfiguration?.vsCodeLmModelSelector?.family ?? vscodeLlmDefaultModelId

			return {
				...openAiModelInfoSaneDefaults,
				...vscodeLlmModels[modelFamily as keyof typeof vscodeLlmModels],
				supportsImages: false, // VSCode LM API currently doesn't support images.
			}
		default:
			return anthropicModels[id as keyof typeof anthropicModels] ?? anthropicDefaultModelId
	}
}
