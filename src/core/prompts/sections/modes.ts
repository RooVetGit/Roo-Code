import * as path from "path"
import * as vscode from "vscode"
import { promises as fs } from "fs"

import { ModeConfig, getAllModesWithPrompts } from "../../../shared/modes"

/**
 * Generate the MODES section of the system prompt
 * @param context - VSCode extension context
 * @returns Formatted MODES section content
 */
export async function getModesSection(context: vscode.ExtensionContext): Promise<string> {
	// Ensure settings directory exists
	const settingsDir = path.join(context.globalStorageUri.fsPath, "settings")
	await fs.mkdir(settingsDir, { recursive: true })

	// Get all modes with their overrides from extension state
	const allModes = await getAllModesWithPrompts(context)

	// Format each mode as a list item with name, slug, and brief description
	const modesList = allModes
		.map((mode: ModeConfig) => `  * "${mode.name}" mode (${mode.slug}) - ${mode.roleDefinition.split(".")[0]}`)
		.join("\n")

	return `====

MODES

- These are the currently available modes:
${modesList}

If the user asks you to create or edit a new mode for this project, you should read the instructions by using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>
`
}
