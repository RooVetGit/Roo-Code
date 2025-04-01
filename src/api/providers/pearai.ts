import * as vscode from "vscode"
import { ApiHandlerOptions, PEARAI_URL, ModelInfo } from "../../shared/api"
import { AnthropicHandler } from "./anthropic"
import { DeepSeekHandler } from "./deepseek"
import Anthropic from "@anthropic-ai/sdk"
import { BaseProvider } from "./base-provider"
import { SingleCompletionHandler } from "../"
import { OpenRouterHandler } from "./openrouter"

interface PearAiModelsResponse {
	models: {
		[key: string]: {
			underlyingModel?: string
			[key: string]: any
		}
	}
	defaultModelId: string
}

export class PearAiHandler extends BaseProvider implements SingleCompletionHandler {
	private handler!: AnthropicHandler | DeepSeekHandler | OpenRouterHandler

	constructor(options: ApiHandlerOptions) {
		super()
		if (!options.pearaiApiKey) {
			vscode.window.showErrorMessage("PearAI API key not found.", "Login to PearAI").then(async (selection) => {
				if (selection === "Login to PearAI") {
					const extensionUrl = `${vscode.env.uriScheme}://pearai.pearai/auth`
					const callbackUri = await vscode.env.asExternalUri(vscode.Uri.parse(extensionUrl))
					vscode.env.openExternal(
						await vscode.env.asExternalUri(
							vscode.Uri.parse(`https://trypear.ai/signin?callback=${callbackUri.toString()}`),
						),
					)
				}
			})
			throw new Error("PearAI API key not found. Please login to PearAI.")
		}

		// // Initialize with a default handler synchronously
		// this.handler = new AnthropicHandler({
		// 	...options,
		// 	apiKey: options.pearaiApiKey,
		// 	anthropicBaseUrl: PEARAI_URL,
		// 	apiModelId: "claude-3-5-sonnet-20241022",
		// })

		this.handler = new OpenRouterHandler({
			...options,
			openRouterBaseUrl: PEARAI_URL,
			openRouterApiKey: options.pearaiApiKey,
			openRouterModelId: "deepseek/deepseek-chat-v3-0324",
		})

		// Then try to initialize the correct handler asynchronously
		this.initializeHandler(options).catch((error) => {
			console.error("Failed to initialize PearAI handler:", error)
		})
	}

	private async initializeHandler(options: ApiHandlerOptions): Promise<void> {
		const modelId = options.apiModelId || "pearai-model"

		if (modelId === "pearai-model") {
			try {
				const response = await fetch(`${PEARAI_URL}/getPearAIAgentModels`)
				if (!response.ok) {
					throw new Error(`Failed to fetch models: ${response.statusText}`)
				}
				const data = (await response.json()) as PearAiModelsResponse
				const underlyingModel = data.models[modelId]?.underlyingModel || "claude-3-5-sonnet-20241022"
				console.dir(underlyingModel)
				if (underlyingModel.startsWith("deepseek")) {
					this.handler = new DeepSeekHandler({
						...options,
						deepSeekApiKey: options.pearaiApiKey,
						deepSeekBaseUrl: PEARAI_URL,
						apiModelId: underlyingModel,
					})
				} else {
					// Default to Claude
					this.handler = new AnthropicHandler({
						...options,
						apiKey: options.pearaiApiKey,
						anthropicBaseUrl: PEARAI_URL,
						apiModelId: underlyingModel,
					})
				}
			} catch (error) {
				console.error("Error fetching PearAI models:", error)
				// Default to Claude if there's an error
				this.handler = new AnthropicHandler({
					...options,
					apiKey: options.pearaiApiKey,
					anthropicBaseUrl: PEARAI_URL,
					apiModelId: "claude-3-5-sonnet-20241022",
				})
			}
		} else if (modelId.startsWith("claude")) {
			this.handler = new AnthropicHandler({
				...options,
				apiKey: options.pearaiApiKey,
				anthropicBaseUrl: PEARAI_URL,
			})
		} else if (modelId.startsWith("deepseek")) {
			// this.handler = new DeepSeekHandler({
			// 	...options,
			// 	deepSeekApiKey: options.pearaiApiKey,
			// 	deepSeekBaseUrl: PEARAI_URL,
			// })
			this.handler = new OpenRouterHandler({
				...options,
				openRouterBaseUrl: PEARAI_URL,
				openRouterApiKey: options.pearaiApiKey,
				openRouterModelId: modelId,
			})
		} else {
			throw new Error(`Unsupported model: ${modelId}`)
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		console.dir(this.handler)
		const baseModel = this.handler.getModel()
		return {
			id: baseModel.id,
			info: {
				...baseModel.info,
				// Inherit all capabilities from the underlying model
				supportsImages: baseModel.info.supportsImages,
				supportsComputerUse: baseModel.info.supportsComputerUse,
				supportsPromptCache: baseModel.info.supportsPromptCache,
				// Apply PearAI's price markup
				inputPrice: (baseModel.info.inputPrice || 0) * 1.03,
				outputPrice: (baseModel.info.outputPrice || 0) * 1.03,
				cacheWritesPrice: baseModel.info.cacheWritesPrice ? baseModel.info.cacheWritesPrice * 1.03 : undefined,
				cacheReadsPrice: baseModel.info.cacheReadsPrice ? baseModel.info.cacheReadsPrice * 1.03 : undefined,
			},
		}
	}

	async *createMessage(systemPrompt: string, messages: any[]): AsyncGenerator<any> {
		const generator = this.handler.createMessage(systemPrompt, messages)
		let warningMsg = ""

		for await (const chunk of generator) {
			console.dir(chunk)
			if (chunk.type === "text" && chunk.metadata?.ui_only) {
				warningMsg += chunk.metadata?.content
				continue
			}
			yield chunk
		}

		if (warningMsg) {
			if (warningMsg.includes("pay-as-you-go")) {
				vscode.window.showInformationMessage(warningMsg, "View Pay-As-You-Go").then((selection) => {
					if (selection === "View Pay-As-You-Go") {
						vscode.env.openExternal(vscode.Uri.parse("https://trypear.ai/pay-as-you-go"))
					}
				})
			} else {
				vscode.window.showInformationMessage(warningMsg)
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		return this.handler.completePrompt(prompt)
	}
}
