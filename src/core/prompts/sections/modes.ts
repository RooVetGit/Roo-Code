import * as path from "path"
import * as vscode from "vscode"
import { promises as fs } from "fs"
import { ModeConfig, getAllModesWithPrompts } from "../../../shared/modes"

export async function getModesSection(context: vscode.ExtensionContext): Promise<string> {
	const settingsDir = path.join(context.globalStorageUri.fsPath, "settings")
	await fs.mkdir(settingsDir, { recursive: true })
	const customModesPath = path.join(settingsDir, "cline_custom_modes.json")

	// Get all modes with their overrides from extension state
	const allModes = await getAllModesWithPrompts(context)

	// Get enableCustomModeCreation setting from extension state
	const shouldEnableCustomModeCreation = (await context.globalState.get<boolean>("enableCustomModeCreation")) ?? true

	let modesContent = `====

MODES

- These are the currently available modes:
${allModes.map((mode: ModeConfig) => `  * "${mode.name}" mode (${mode.slug}) - ${mode.roleDefinition.split(".")[0]}`).join("\n")}`

	// Only include custom modes documentation if the feature is enabled
	if (shouldEnableCustomModeCreation) {
		modesContent += `

- Custom modes can be configured in two ways:
  1. Globally via '${customModesPath}' (created automatically on startup)
  2. Per-workspace via '.roomodes' in the workspace root directory

  When modes with the same slug exist in both files, the workspace-specific .roomodes version takes precedence. This allows projects to override global modes or define project-specific modes.

If the user asks you to create new mode for this project, you can get instructions using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>
`
	}

	return modesContent
}
