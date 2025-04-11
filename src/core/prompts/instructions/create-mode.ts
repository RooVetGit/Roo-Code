import * as path from "path"
import * as vscode from "vscode"
import { promises as fs } from "fs"
import { GlobalFileNames } from "../../../shared/globalFileNames"

export async function createModeInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	const settingsDir = path.join(context.globalStorageUri.fsPath, "settings")
	const customModesPath = path.join(settingsDir, GlobalFileNames.customModes)

	return `
Custom modes can be configured in three ways:
  1. Globally via '${customModesPath}' (created automatically on startup)
  2. Per-workspace via '.roomodes' in the workspace root directory (legacy format)
  3. Per-workspace via '.roo/modes/[mode-slug].yaml' files (new YAML format)

When modes with the same slug exist in multiple locations, the workspace-specific versions take precedence over global modes. If both '.roomodes' and '.roo/modes/' exist in a workspace, '.roomodes' takes precedence. This allows projects to override global modes or define project-specific modes.


If asked to create a project mode:
	 - If '.roomodes' exists in the workspace, add the mode there
	 - If '.roomodes' doesn't exist, create a new YAML file at '.roo/modes/[mode-slug].yaml'

If asked to create a global mode, use the global custom modes file.

- The following fields are required and must not be empty:
  * slug: A valid slug (lowercase letters, numbers, and hyphens). Must be unique, and shorter is better.
  * name: The display name for the mode
  * roleDefinition: A detailed description of the mode's role and capabilities
  * groups: Array of allowed tool groups (can be empty). Each group can be specified either as a string (e.g., "edit" to allow editing any file) or with file restrictions (e.g., ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }] to only allow editing markdown files)

- The customInstructions field is optional.

- For multi-line text, include newline characters in the string like "This is the first line.\\nThis is the next line.\\n\\nThis is a double line break."

The JSON format for '.roomodes' and the global custom modes file should follow this structure:
{
 "customModes": [
   {
     "slug": "designer", // Required: unique slug with lowercase letters, numbers, and hyphens
     "name": "Designer", // Required: mode display name
     "roleDefinition": "You are Roo, a UI/UX expert specializing in design systems and frontend development. Your expertise includes:\\n- Creating and maintaining design systems\\n- Implementing responsive and accessible web interfaces\\n- Working with CSS, HTML, and modern frontend frameworks\\n- Ensuring consistent user experiences across platforms", // Required: non-empty
     "groups": [ // Required: array of tool groups (can be empty)
       "read",    // Read files group (read_file, fetch_instructions, search_files, list_files, list_code_definition_names)
       "edit",    // Edit files group (apply_diff, write_to_file) - allows editing any file
       // Or with file restrictions:
       // ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }],  // Edit group that only allows editing markdown files
       "browser", // Browser group (browser_action)
       "command", // Command group (execute_command)
       "mcp"     // MCP group (use_mcp_tool, access_mcp_resource)
     ],
     "customInstructions": "Additional instructions for the Designer mode" // Optional
    }
  ]
}

The YAML format for '.roo/modes/[mode-slug].yaml' files should follow this structure:
# yaml-language-server: $schema=https://raw.githubusercontent.com/RooVetGit/Roo-Code/refs/heads/main/custom-mode-schema.json
name: Designer
roleDefinition: |
  You are Roo, a UI/UX expert specializing in design systems and frontend development. Your expertise includes:
  - Creating and maintaining design systems
  - Implementing responsive and accessible web interfaces
  - Working with CSS, HTML, and modern frontend frameworks
  - Ensuring consistent user experiences across platforms
customInstructions: |
  Additional instructions for the Designer mode
groups:
  - read
  - edit:
      fileRegex: "\\\\.md$"
      description: Markdown files only
  - browser
  - command
  - mcp

Note: The slug is derived from the filename (e.g., designer.yaml will have slug "designer").`
}
