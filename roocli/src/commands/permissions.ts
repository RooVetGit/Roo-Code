import { WebSocketClient } from "@roo-code/comms-clients"
import chalk from "chalk"
import { Command } from "commander"
import { displayBox } from "../utils/display"
import {
	ToolPermissionSettings,
	getToolPermissionSettings,
	updateToolPermissionSettings,
} from "../utils/settings-storage"
import { ToolCategory, getToolsInCategory } from "../utils/tool-categories"

/**
 * Create the permissions command
 * @param wsClient The WebSocket client
 * @returns The permissions command
 */
export function permissionsCommand(wsClient: WebSocketClient): Command {
	const command = new Command("permissions")
		.description("Manage tool permissions")
		.addCommand(listPermissionsCommand())

	return command
}

/**
 * Create the list permissions command
 * @returns The list permissions command
 */
export function listPermissionsCommand(): Command {
	return new Command("permissions")
		.description("List current tool permissions")
		.option("-v, --verbose", "Show detailed information including tools in each category")
		.option("--json", "Output in JSON format")
		.action(async (options) => {
			try {
				const settings = getToolPermissionSettings()

				if (options.json) {
					// Output in JSON format
					console.log(JSON.stringify(settings, null, 2))
					return
				}

				// Output in human-readable format
				console.log(chalk.blue("\nTool Permission Settings:"))
				console.log(chalk.blue("======================"))

				console.log(`${chalk.green("Auto-Approval Enabled:")} ${settings.autoApprovalEnabled ? "Yes" : "No"}`)
				console.log("")

				// Display each permission setting
				console.log(chalk.yellow("Category Permissions:"))
				console.log(
					`${chalk.green("Read-Only Operations:")} ${settings.alwaysAllowReadOnly ? "Auto-Approve" : "Ask"}`,
				)
				console.log(`${chalk.green("Write Operations:")} ${settings.alwaysAllowWrite ? "Auto-Approve" : "Ask"}`)
				console.log(
					`${chalk.green("Execute Operations:")} ${settings.alwaysAllowExecute ? "Auto-Approve" : "Ask"}`,
				)
				console.log(
					`${chalk.green("Browser Operations:")} ${settings.alwaysAllowBrowser ? "Auto-Approve" : "Ask"}`,
				)
				console.log(`${chalk.green("MCP Operations:")} ${settings.alwaysAllowMcp ? "Auto-Approve" : "Ask"}`)
				console.log(
					`${chalk.green("Mode Switch Operations:")} ${settings.alwaysAllowModeSwitch ? "Auto-Approve" : "Ask"}`,
				)
				console.log(
					`${chalk.green("Subtask Operations:")} ${settings.alwaysAllowSubtasks ? "Auto-Approve" : "Ask"}`,
				)
				console.log(
					`${chalk.green("API Retry Operations:")} ${settings.alwaysApproveResubmit ? "Auto-Approve" : "Ask"}`,
				)

				// Display tools in each category
				if (options.verbose) {
					console.log("")
					console.log(chalk.yellow("Tools by Category:"))

					Object.values(ToolCategory).forEach((category) => {
						const tools = getToolsInCategory(category)
						if (tools.length > 0) {
							console.log(`${chalk.green(category + ":")} ${tools.join(", ")}`)
						}
					})
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the update permissions command
 * @param wsClient The WebSocket client
 * @returns The update permissions command
 */
export function updatePermissionsCommand(wsClient: WebSocketClient): Command {
	return new Command("permissions")
		.description("Update permission settings")
		.option("--auto-approval <boolean>", "Enable or disable auto-approval")
		.option("--read-only <boolean>", "Auto-approve read-only operations")
		.option("--write <boolean>", "Auto-approve write operations")
		.option("--execute <boolean>", "Auto-approve execute operations")
		.option("--browser <boolean>", "Auto-approve browser operations")
		.option("--mcp <boolean>", "Auto-approve MCP operations")
		.option("--mode-switch <boolean>", "Auto-approve mode switch operations")
		.option("--subtasks <boolean>", "Auto-approve subtask operations")
		.option("--api-retry <boolean>", "Auto-approve API retry operations")
		.option("--reset", "Reset all permissions to default values")
		.option("--confirm", "Confirm reset without prompting")
		.action(async (options) => {
			try {
				// Handle reset option
				if (options.reset) {
					if (!options.confirm) {
						console.log(chalk.yellow("This will reset all tool permissions to their default values."))
						console.log(chalk.yellow("Run with --confirm to proceed."))
						return
					}

					// Reset all permissions to default values
					const success = updateToolPermissionSettings({
						autoApprovalEnabled: false,
						alwaysAllowReadOnly: false,
						alwaysAllowWrite: false,
						alwaysAllowExecute: false,
						alwaysAllowBrowser: false,
						alwaysAllowMcp: false,
						alwaysAllowModeSwitch: false,
						alwaysAllowSubtasks: false,
						alwaysApproveResubmit: false,
					})

					if (success) {
						displayBox(
							"Permissions Reset",
							"All tool permissions have been reset to their default values.",
							"success",
						)
					} else {
						console.error(chalk.red("Failed to reset permissions. Check file permissions and try again."))
					}
					return
				}

				const updates: Partial<ToolPermissionSettings> = {}
				let hasUpdates = false

				// Parse boolean options
				const parseBool = (value: string): boolean | undefined => {
					if (value === "true" || value === "yes" || value === "1") return true
					if (value === "false" || value === "no" || value === "0") return false
					return undefined
				}

				// Check each option and add to updates if provided
				if (options.autoApproval !== undefined) {
					const value = parseBool(options.autoApproval)
					if (value !== undefined) {
						updates.autoApprovalEnabled = value
						hasUpdates = true
					}
				}

				if (options.readOnly !== undefined) {
					const value = parseBool(options.readOnly)
					if (value !== undefined) {
						updates.alwaysAllowReadOnly = value
						hasUpdates = true
					}
				}

				if (options.write !== undefined) {
					const value = parseBool(options.write)
					if (value !== undefined) {
						updates.alwaysAllowWrite = value
						hasUpdates = true
					}
				}

				if (options.execute !== undefined) {
					const value = parseBool(options.execute)
					if (value !== undefined) {
						updates.alwaysAllowExecute = value
						hasUpdates = true
					}
				}

				if (options.browser !== undefined) {
					const value = parseBool(options.browser)
					if (value !== undefined) {
						updates.alwaysAllowBrowser = value
						hasUpdates = true
					}
				}

				if (options.mcp !== undefined) {
					const value = parseBool(options.mcp)
					if (value !== undefined) {
						updates.alwaysAllowMcp = value
						hasUpdates = true
					}
				}

				if (options.modeSwitch !== undefined) {
					const value = parseBool(options.modeSwitch)
					if (value !== undefined) {
						updates.alwaysAllowModeSwitch = value
						hasUpdates = true
					}
				}

				// Handle hyphenated option names
				if (options.modeSwitch === undefined && options["mode-switch"] !== undefined) {
					const value = parseBool(options["mode-switch"])
					if (value !== undefined) {
						updates.alwaysAllowModeSwitch = value
						hasUpdates = true
					}
				}

				if (options.subtasks !== undefined) {
					const value = parseBool(options.subtasks)
					if (value !== undefined) {
						updates.alwaysAllowSubtasks = value
						hasUpdates = true
					}
				}

				if (options.apiRetry !== undefined) {
					const value = parseBool(options.apiRetry)
					if (value !== undefined) {
						updates.alwaysApproveResubmit = value
						hasUpdates = true
					}
				}

				// Handle hyphenated option names
				if (options.apiRetry === undefined && options["api-retry"] !== undefined) {
					const value = parseBool(options["api-retry"])
					if (value !== undefined) {
						updates.alwaysApproveResubmit = value
						hasUpdates = true
					}
				}

				if (!hasUpdates) {
					console.log(chalk.yellow("No valid permission updates provided."))
					console.log("Use --help to see available options.")
					return
				}

				// Update the settings
				const success = updateToolPermissionSettings(updates)

				if (success) {
					displayBox("Permissions Updated", "Tool permissions have been successfully updated.", "success")

					// Show the updated settings
					const settings = getToolPermissionSettings()
					console.log(chalk.blue("\nUpdated Tool Permission Settings:"))

					Object.entries(updates).forEach(([key, value]) => {
						const formattedKey = key
							.replace(/([A-Z])/g, " $1")
							.replace(/^./, (str) => str.toUpperCase())
							.replace(/Always Allow/g, "")
							.trim()

						console.log(`${chalk.green(formattedKey + ":")} ${value ? "Auto-Approve" : "Ask"}`)
					})
				} else {
					console.error(chalk.red("Failed to update permissions. Check file permissions and try again."))
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
