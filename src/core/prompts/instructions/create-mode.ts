import * as path from "path"
import * as vscode from "vscode"
import { GlobalFileNames } from "../../../shared/globalFileNames"

/**
 * Generate instructions for creating custom modes
 * @param context - VSCode extension context
 * @returns Formatted instructions for mode creation
 * @throws Error if context is missing
 */
export async function createModeInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	const settingsDir = path.join(context.globalStorageUri.fsPath, "settings")
	const customModesPath = path.join(settingsDir, GlobalFileNames.customModes)

	return `# CUSTOM MODE CREATION

## Configuration Locations

Custom modes can be configured in two ways:
  1. Globally via '${customModesPath}'
  2. Per-workspace via '.roomodes' in the workspace root

Workspace-specific modes override global modes with the same slug.

## Guidelines

- Create project-specific modes in .roomodes
- Create global modes in the global custom modes file
- Always test your custom mode after creation

## Required Fields

- slug: Unique identifier using lowercase letters, numbers, and hyphens
- name: Display name for the mode
- roleDefinition: Detailed description of the mode's capabilities
- groups: Array of tool access groups

## Example Structure

\`\`\`json
{
  "customModes": [
    {
      "slug": "designer",
      "name": "Designer",
      "roleDefinition": "You are Roo, a UI/UX expert specializing in design systems and frontend development. Your expertise includes:\\n- Creating and maintaining design systems\\n- Implementing responsive and accessible web interfaces\\n- Working with CSS, HTML, and modern frontend frameworks",
      "groups": [
        "read",   // read_file, fetch_instructions, search_files, list_files, list_code_definition_names
        "edit",   // apply_diff, write_to_file (all files)
        // Restricted editing example:
        // ["edit", { "fileRegex": "\\.md$", "description": "Markdown files only" }],
        "browser", // browser_action
        "command"  // execute_command
      ],
      "customInstructions": "Optional additional instructions for the mode"
    }
  ]
}
\`\`\`

Remember to use \\n for line breaks in multi-line strings.`
}
