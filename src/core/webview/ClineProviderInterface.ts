import * as vscode from "vscode"
import { SettingsManager } from "../settings/SettingsManager"
import { ModelManager } from "../models/ModelManager"
import { TaskHistoryManager } from "../tasks/TaskHistoryManager"
import { ConfigManager } from "../config/ConfigManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { BrowserManager } from "../browser/BrowserManager"
import { McpHub } from "../../services/mcp/McpHub"
import { ApiConfiguration } from "../../shared/api"
import { HistoryItem } from "../../shared/HistoryItem"
import { Mode } from "../../shared/modes"
import { Cline } from "../Cline"
import { experimentDefault } from "../../shared/experiments"

/**
 * Interface for ClineProvider properties and methods needed by WebviewMessageHandlers
 */
export interface ClineProviderInterface {
	// Properties
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	settingsManager: SettingsManager
	modelManager: ModelManager
	taskHistoryManager: TaskHistoryManager
	configManager: ConfigManager
	customModesManager: CustomModesManager
	browserManager: BrowserManager
	cline?: Cline
	view?: vscode.WebviewView | vscode.WebviewPanel
	isViewLaunched: boolean
	latestAnnouncementId: string
	workspaceTracker?: any
	experimentDefault: typeof experimentDefault

	// Methods
	getMcpHub(): McpHub | undefined
	postStateToWebview(): Promise<void>
	postMessageToWebview(message: any): Promise<void>
	getState(): Promise<any>
	updateApiConfiguration(apiConfiguration: ApiConfiguration): Promise<void>
	initClineWithTask(task?: string, images?: string[]): Promise<void>
	initClineWithHistoryItem(historyItem: HistoryItem): Promise<void>
	clearTask(): Promise<void>
	cancelTask(): Promise<void>
	updateCustomInstructions(instructions?: string): Promise<void>
	handleModeSwitch(newMode: Mode): Promise<void>
	resetState(): Promise<void>
	getDiffStrategy(modelId: string, fuzzyMatchThreshold: number, useExperimentalDiffStrategy: boolean): any
	getSystemPrompt(
		cwd: string,
		supportsComputerUse: boolean,
		mcpHub: McpHub | undefined,
		diffStrategy: any,
		browserViewportSize: string,
		mode: string,
		customModePrompts: any,
		customModes: any,
		customInstructions: string | undefined,
		preferredLanguage: string,
		diffEnabled: boolean,
		experiments: Record<string, boolean>,
		enableMcpServerCreation: boolean,
	): Promise<string>
}
