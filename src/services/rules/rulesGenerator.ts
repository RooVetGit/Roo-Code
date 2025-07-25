import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { GlobalState } from "@roo-code/types"
import {
	generateRulesInstructions,
	ruleTypeDefinitions,
	RulesGenerationOptions,
	RuleInstruction,
} from "../../core/prompts/instructions/generate-rules"
import { getWorkspacePath } from "../../utils/path"
import { ClineProvider } from "../../core/webview/ClineProvider"

/**
 * Creates a comprehensive task message for rules generation that can be used with initClineWithTask
 */
export async function createRulesGenerationTaskMessage(
	workspacePath: string,
	selectedRuleTypes: string[],
	addToGitignore: boolean,
	alwaysAllowWriteProtected: boolean = false,
	includeCustomRules: boolean = false,
	customRulesText: string = "",
): Promise<string> {
	// Only create directories if auto-approve is enabled
	if (alwaysAllowWriteProtected) {
		const directoriesToCreate = [
			path.join(workspacePath, ".roo", "rules"),
			path.join(workspacePath, ".roo", "rules-code"),
			path.join(workspacePath, ".roo", "rules-architect"),
			path.join(workspacePath, ".roo", "rules-debug"),
			path.join(workspacePath, ".roo", "rules-docs-extractor"),
		]

		for (const dir of directoriesToCreate) {
			try {
				await fs.mkdir(dir, { recursive: true })
			} catch (error) {
				// Directory might already exist, which is fine
			}
		}
	}

	// Create rule-specific instructions based on selected types
	const ruleInstructions: RuleInstruction[] = selectedRuleTypes
		.map((type) => {
			const definition = ruleTypeDefinitions[type as keyof typeof ruleTypeDefinitions]
			return definition || null
		})
		.filter((rule): rule is RuleInstruction => rule !== null)

	const options: RulesGenerationOptions = {
		selectedRuleTypes,
		addToGitignore,
		alwaysAllowWriteProtected,
		includeCustomRules,
		customRulesText,
	}

	return generateRulesInstructions(ruleInstructions, options)
}

/**
 * Options for generating rules
 */
export interface GenerateRulesOptions {
	selectedRuleTypes?: string[]
	addToGitignore?: boolean
	alwaysAllowWriteProtected?: boolean
	apiConfigName?: string
	includeCustomRules?: boolean
	customRulesText?: string
}

/**
 * Handles the complete rules generation process including API config switching,
 * task creation, and UI navigation
 */
export async function handleGenerateRules(
	provider: ClineProvider,
	options: GenerateRulesOptions,
	getGlobalState: <K extends keyof GlobalState>(key: K) => GlobalState[K],
	updateGlobalState: <K extends keyof GlobalState>(key: K, value: GlobalState[K]) => Promise<void>,
): Promise<void> {
	const workspacePath = getWorkspacePath()
	if (!workspacePath) {
		vscode.window.showErrorMessage("No workspace folder open. Please open a folder to generate rules.")
		return
	}

	// Extract options with defaults
	const selectedRuleTypes = options.selectedRuleTypes || ["general"]
	const addToGitignore = options.addToGitignore || false
	const alwaysAllowWriteProtected = options.alwaysAllowWriteProtected || false
	const apiConfigName = options.apiConfigName
	const includeCustomRules = options.includeCustomRules || false
	const customRulesText = options.customRulesText || ""

	// Switch to the selected API config if provided
	if (apiConfigName) {
		const currentApiConfig = getGlobalState("currentApiConfigName")
		if (apiConfigName !== currentApiConfig) {
			await updateGlobalState("currentApiConfigName", apiConfigName)
			await provider.activateProviderProfile({ name: apiConfigName })
		}
	}

	// Create a comprehensive message for the rules generation task
	const rulesGenerationMessage = await createRulesGenerationTaskMessage(
		workspacePath,
		selectedRuleTypes,
		addToGitignore,
		alwaysAllowWriteProtected,
		includeCustomRules,
		customRulesText,
	)

	// Spawn a new task in code mode to generate the rules
	await provider.initClineWithTask(rulesGenerationMessage)

	// Automatically navigate to the chat tab to show the new task
	await provider.postMessageToWebview({
		type: "action",
		action: "switchTab",
		tab: "chat",
	})
}
