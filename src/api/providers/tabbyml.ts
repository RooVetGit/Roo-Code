import * as vscode from "vscode"
import { OpenAiHandler, OpenAiHandlerOptions } from "./openai"

export interface TabbyConfig {
	endpoint: string
	apiKey?: string
}

const TABBY_EXTENSION_ID = "TabbyML.vscode-tabby"

export class TabbyHandler extends OpenAiHandler {
	constructor(options: OpenAiHandlerOptions) {
		const normalizedBaseUrl = options.tabbyBaseUrl?.endsWith("/")
			? options.tabbyBaseUrl.slice(0, -1)
			: options.tabbyBaseUrl

		super({
			...options,
			openAiApiKey: options.tabbyApiKey ?? "",
			openAiModelId: options.tabbyModelId ?? "",
			openAiBaseUrl: `${normalizedBaseUrl}/v1`,
			openAiStreamingEnabled: true,
			includeMaxTokens: false,
		})
	}
}

export async function fetchLatestTabbyConfig(): Promise<TabbyConfig> {
	try {
		const config = vscode.workspace.getConfiguration("tabby")
		const endpoint = config.get("endpoint", "")

		const tabbyExtension = vscode.extensions.getExtension(TABBY_EXTENSION_ID)

		if (!tabbyExtension) {
			return { endpoint }
		}

		let tabbyApi
		if (tabbyExtension.isActive) {
			tabbyApi = tabbyExtension.exports
		} else {
			tabbyApi = await tabbyExtension.activate()
		}

		if (tabbyApi && typeof tabbyApi.tryReadAuthenticationToken === "function") {
			const token = (await tabbyApi.tryReadAuthenticationToken()).token
			return {
				endpoint,
				apiKey: token,
			}
		}
		return {
			endpoint,
		}
	} catch (error) {
		throw error
	}
}

export async function getTabbyModels(
	tabbyBaseUrl: string = "http://localhost:8080",
	tabbyApiKey?: string,
): Promise<string[]> {
	if (!tabbyBaseUrl) {
		return []
	}

	const normalizedBaseUrl = tabbyBaseUrl.endsWith("/") ? tabbyBaseUrl.slice(0, -1) : tabbyBaseUrl

	const url = `${normalizedBaseUrl}/v1beta/models`

	try {
		const options = {
			method: "GET",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${tabbyApiKey}`,
				"Content-Type": "application/json",
			},
		}

		const response = await fetch(url, options)

		if (!response.ok) {
			return []
		}

		const data = await response.json()

		if (data && data.chat && Array.isArray(data.chat)) {
			return data.chat
		} else {
			return []
		}
	} catch (error) {
		return []
	}
}
