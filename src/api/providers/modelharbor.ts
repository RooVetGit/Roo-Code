import {
	modelHarborModels,
	modelHarborDefaultModelId,
	getModelHarborModels,
	setModelHarborOutputChannel,
	type ModelHarborModelId,
} from "@roo-code/types"
import * as vscode from "vscode"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

// Create ModelHarbor-specific output channel
let modelHarborOutputChannel: vscode.OutputChannel | null = null

export class ModelHarborHandler extends BaseOpenAiCompatibleProvider<ModelHarborModelId> {
	private modelsCache: Record<string, any> | null = null

	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "ModelHarbor",
			baseURL: "https://api.modelharbor.com/v1",
			apiKey: options.modelharborApiKey,
			defaultProviderModelId: modelHarborDefaultModelId,
			providerModels: modelHarborModels,
			defaultTemperature: 0.7,
		})

		// Set up output channel for logging if not already done
		if (!modelHarborOutputChannel) {
			modelHarborOutputChannel = vscode.window.createOutputChannel("ModelHarbor")
			setModelHarborOutputChannel(modelHarborOutputChannel)
		}

		// Initialize models cache
		this.initializeModels()
	}

	private async initializeModels() {
		try {
			if (modelHarborOutputChannel) {
				modelHarborOutputChannel.appendLine("🚀 Initializing ModelHarbor models from extension host...")
			}
			this.modelsCache = await getModelHarborModels()
			if (modelHarborOutputChannel) {
				const modelCount = Object.keys(this.modelsCache).length
				modelHarborOutputChannel.appendLine(`✅ Successfully initialized ${modelCount} ModelHarbor models`)
			}
		} catch (error) {
			const errorMsg = `Failed to initialize ModelHarbor models: ${error}`
			console.error(errorMsg)
			if (modelHarborOutputChannel) {
				modelHarborOutputChannel.appendLine(`❌ ${errorMsg}`)
			}
		}
	}

	override getModel() {
		// Use cached models if available, otherwise fall back to proxy
		const availableModels = this.modelsCache || this.providerModels

		const id =
			this.options.modelharborModelId && this.options.modelharborModelId in availableModels
				? (this.options.modelharborModelId as ModelHarborModelId)
				: this.defaultProviderModelId

		return { id, info: availableModels[id] }
	}

	// Method to refresh models if needed
	async refreshModels() {
		try {
			this.modelsCache = await getModelHarborModels()
		} catch (error) {
			console.error("Failed to refresh ModelHarbor models:", error)
		}
	}
}
