import os from "os"
import osName from "os-name"
import { Mode, ModeConfig } from "../../../shared/modes"
import { getShell } from "../../../utils/shell"
import { WORKSPACE_DIR_EXPLANATION } from "../constants"

/**
 * Generate the system information section for the prompt
 * @param cwd - Current workspace directory
 * @param currentMode - Current active mode
 * @param customModes - Custom mode configurations
 * @returns Formatted system information section
 */
export function getSystemInfoSection(cwd: string, _currentMode: Mode, _customModes?: ModeConfig[]): string {
	return `====

SYSTEM INFORMATION

Operating System: ${osName()}
Default Shell: ${getShell()}
Home Directory: ${os.homedir().toPosix()}
Current Workspace Directory: ${cwd.toPosix()}

${WORKSPACE_DIR_EXPLANATION} When the user gives you a task, you'll receive a file list in environment_details to help understand the project structure. For directories outside the workspace, use list_files with recursive=true for full listing or false for top-level contents.`
}
