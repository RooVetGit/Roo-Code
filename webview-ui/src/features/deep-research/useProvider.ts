import { useCallback, useMemo } from "react"

import { ApiConfiguration } from "../../../../src/shared/api"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

export const PROVIDERS = ["openrouter", "openai-native"]

export type ProviderMetadata = {
	profileId: string
	profileName: string
	providerId: string
	providerName: string
}

export type Provider = ProviderMetadata & {
	providerApiKey?: string
	firecrawlApiKey?: string
}

export type UseProvider = {
	provider?: Provider
	providers: ProviderMetadata[]
	setProvider: (provider: Provider) => void
	setProviderValue: (key: keyof ApiConfiguration, value: string) => void
}

export const useProvider = (): UseProvider => {
	const { apiConfiguration, currentApiConfigName, listApiConfigMeta, handleInputChange } = useExtensionState()

	const providers = useMemo(
		() =>
			listApiConfigMeta
				?.filter((config) => PROVIDERS.includes(config.apiProvider ?? ""))
				.map((p) => ({
					profileId: p.id,
					profileName: p.name,
					providerId: p.apiProvider!,
					providerName: p.apiProvider === "openrouter" ? "OpenRouter" : "OpenAI",
				})) ?? [],
		[listApiConfigMeta],
	)

	const provider = useMemo(() => {
		if (
			!apiConfiguration?.apiProvider ||
			!PROVIDERS.includes(apiConfiguration.apiProvider) ||
			!currentApiConfigName ||
			!listApiConfigMeta
		) {
			return undefined
		}

		const matchedProvider = providers.find(
			({ profileName, providerId }) =>
				profileName === currentApiConfigName && providerId === apiConfiguration.apiProvider,
		)

		if (!matchedProvider) {
			return undefined
		}

		const { openRouterApiKey, openAiNativeApiKey, firecrawlApiKey } = apiConfiguration

		return {
			...matchedProvider,
			providerApiKey: matchedProvider.providerId === "openrouter" ? openRouterApiKey : openAiNativeApiKey,
			firecrawlApiKey,
		}
	}, [apiConfiguration, currentApiConfigName, listApiConfigMeta, providers])

	const setProvider = useCallback(
		({ profileName }: ProviderMetadata) => vscode.postMessage({ type: "loadApiConfiguration", text: profileName }),
		[],
	)

	const setProviderValue = useCallback(
		(key: keyof ApiConfiguration, value: string) => {
			handleInputChange(key)({ target: { value } })
		},
		[handleInputChange],
	)

	return { provider, providers, setProvider, setProviderValue }
}
