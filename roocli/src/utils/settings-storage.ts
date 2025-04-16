import chalk from "chalk"
import fs from "fs"
import os from "os"
import path from "path"

/**
 * Interface for tool permission settings
 */
export interface ToolPermissionSettings {
	autoApprovalEnabled: boolean
	alwaysAllowReadOnly: boolean
	alwaysAllowWrite: boolean
	alwaysAllowExecute: boolean
	alwaysAllowBrowser: boolean
	alwaysAllowMcp: boolean
	alwaysAllowModeSwitch: boolean
	alwaysAllowSubtasks: boolean
	alwaysApproveResubmit: boolean
}

/**
 * Default tool permission settings
 */
export const defaultToolPermissionSettings: ToolPermissionSettings = {
	autoApprovalEnabled: false,
	alwaysAllowReadOnly: false,
	alwaysAllowWrite: false,
	alwaysAllowExecute: false,
	alwaysAllowBrowser: false,
	alwaysAllowMcp: false,
	alwaysAllowModeSwitch: false,
	alwaysAllowSubtasks: false,
	alwaysApproveResubmit: false,
}

/**
 * Interface for roocli settings
 */
export interface RoocliSettings {
	toolPermissions: ToolPermissionSettings
	// Add other settings categories here as needed
}

/**
 * Default roocli settings
 */
export const defaultSettings: RoocliSettings = {
	toolPermissions: defaultToolPermissionSettings,
}

/**
 * Get the path to the settings file
 * @returns The path to the settings file
 */
export function getSettingsFilePath(): string {
	const homeDir = os.homedir()
	const roocliDir = path.join(homeDir, ".roocli")

	// Create the directory if it doesn't exist
	if (!fs.existsSync(roocliDir)) {
		try {
			fs.mkdirSync(roocliDir, { recursive: true })
		} catch (error) {
			console.error(
				chalk.red(
					`Error creating settings directory: ${error instanceof Error ? error.message : String(error)}`,
				),
			)
		}
	}

	return path.join(roocliDir, "settings.json")
}

/**
 * Load settings from the settings file
 * @returns The loaded settings, or default settings if the file doesn't exist
 */
export function loadSettings(): RoocliSettings {
	const settingsPath = getSettingsFilePath()

	if (!fs.existsSync(settingsPath)) {
		return defaultSettings
	}

	try {
		const settingsJson = fs.readFileSync(settingsPath, "utf-8")
		const settings = JSON.parse(settingsJson) as RoocliSettings

		// Ensure all required fields exist by merging with defaults
		return {
			toolPermissions: {
				...defaultToolPermissionSettings,
				...settings.toolPermissions,
			},
			// Merge other settings categories here as needed
		}
	} catch (error) {
		console.error(chalk.red(`Error loading settings: ${error instanceof Error ? error.message : String(error)}`))
		return defaultSettings
	}
}

/**
 * Save settings to the settings file
 * @param settings The settings to save
 * @returns True if the settings were saved successfully, false otherwise
 */
export function saveSettings(settings: RoocliSettings): boolean {
	const settingsPath = getSettingsFilePath()

	try {
		const settingsJson = JSON.stringify(settings, null, 2)
		fs.writeFileSync(settingsPath, settingsJson, "utf-8")
		return true
	} catch (error) {
		console.error(chalk.red(`Error saving settings: ${error instanceof Error ? error.message : String(error)}`))
		return false
	}
}

/**
 * Update tool permission settings
 * @param updates Partial updates to apply to the tool permission settings
 * @returns True if the settings were updated successfully, false otherwise
 */
export function updateToolPermissionSettings(updates: Partial<ToolPermissionSettings>): boolean {
	const settings = loadSettings()

	settings.toolPermissions = {
		...settings.toolPermissions,
		...updates,
	}

	return saveSettings(settings)
}

/**
 * Get the current tool permission settings
 * @returns The current tool permission settings
 */
export function getToolPermissionSettings(): ToolPermissionSettings {
	return loadSettings().toolPermissions
}
