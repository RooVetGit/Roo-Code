import * as vscode from "vscode"
import * as path from "path"
import { McpHub } from "../../services/mcp/McpHub"
import { Mode, CustomModePrompts } from "../../shared/modes"
import { ExperimentId } from "../../shared/experiments"

/**
 * Responsible for generating system prompts based on various configuration parameters
 */
export class SystemPromptGenerator {
	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Generate a system prompt based on the provided parameters
	 */
	public async generate(
		cwd: string,
		supportsComputerUse: boolean,
		mcpHub: McpHub | undefined,
		diffStrategy: any,
		browserViewportSize: string,
		mode: Mode,
		customModePrompts: CustomModePrompts | undefined,
		customModes: any,
		customInstructions: string | undefined,
		preferredLanguage: string,
		diffEnabled: boolean,
		experiments: Record<ExperimentId, boolean>,
		enableMcpServerCreation: boolean,
	): Promise<string> {
		// Import the SYSTEM_PROMPT function dynamically to avoid circular dependencies
		const { SYSTEM_PROMPT } = await import("./system")

		return SYSTEM_PROMPT(
			this.context,
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize,
			mode,
			customModePrompts,
			customModes,
			customInstructions,
			preferredLanguage,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
		)
	}
}
