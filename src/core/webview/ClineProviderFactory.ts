import * as vscode from "vscode"
import { ClineProvider } from "./ClineProvider"
import { SettingsManager } from "../settings/SettingsManager"
import { ModelManager } from "../models/ModelManager"
import { TaskHistoryManager } from "../tasks/TaskHistoryManager"
import { WebviewManager } from "./WebviewManager"
import { WebviewMessageHandlers } from "./WebviewMessageHandlers"
import { WebviewCommandRegistry } from "./commands/WebviewCommandRegistry"
import { SystemPromptGenerator } from "../prompts/SystemPromptGenerator"
import { BrowserManager } from "../browser/BrowserManager"
import { ConfigManager } from "../config/ConfigManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { ServiceLocator } from "../ServiceLocator"

/**
 * Factory for creating ClineProvider instances with all required dependencies.
 * This simplifies the creation process and ensures proper initialization.
 */
export class ClineProviderFactory {
	/**
	 * Creates a new ClineProvider instance with all required dependencies.
	 * @param context The extension context
	 * @param outputChannel The output channel for logging
	 * @returns A fully initialized ClineProvider instance
	 */
	static create(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): ClineProvider {
		// Initialize the ServiceLocator
		const serviceLocator = ServiceLocator.getInstance()

		// Register context and outputChannel
		serviceLocator.register("context", context)
		serviceLocator.register("outputChannel", outputChannel)

		// Initialize all dependencies
		const settingsManager = new SettingsManager(context)
		const configManager = new ConfigManager(context)
		const customModesManager = new CustomModesManager(context, async () => {
			// This callback will be passed to the provider later
		})
		const modelManager = new ModelManager(context, outputChannel, settingsManager)
		const taskHistoryManager = new TaskHistoryManager(context, settingsManager, outputChannel)
		const webviewManager = new WebviewManager(context, outputChannel)
		const commandRegistry = new WebviewCommandRegistry()
		const systemPromptGenerator = new SystemPromptGenerator(context)
		const browserManager = new BrowserManager(context, outputChannel)

		// Register all services with the ServiceLocator
		serviceLocator.register("settingsManager", settingsManager)
		serviceLocator.register("configManager", configManager)
		serviceLocator.register("customModesManager", customModesManager)
		serviceLocator.register("modelManager", modelManager)
		serviceLocator.register("taskHistoryManager", taskHistoryManager)
		serviceLocator.register("webviewManager", webviewManager)
		serviceLocator.register("commandRegistry", commandRegistry)
		serviceLocator.register("systemPromptGenerator", systemPromptGenerator)
		serviceLocator.register("browserManager", browserManager)

		// Create and return the ClineProvider instance
		const provider = new ClineProvider(context, outputChannel)

		// Register the provider itself
		serviceLocator.register("clineProvider", provider)

		return provider
	}
}
