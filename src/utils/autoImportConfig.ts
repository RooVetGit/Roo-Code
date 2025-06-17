import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import fs from "fs/promises"
import { z, ZodError } from "zod"

import { globalSettingsSchema } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { ProviderSettingsManager, providerProfilesSchema } from "../core/config/ProviderSettingsManager"
import { ContextProxy } from "../core/config/ContextProxy"
import { CustomModesManager } from "../core/config/CustomModesManager"
import { fileExistsAtPath } from "./fs"

type AutoImportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: ContextProxy
	customModesManager: CustomModesManager
	outputChannel: vscode.OutputChannel
}

/**
 * Automatically imports RooCode configuration from a specified path if it exists.
 * This function is called during extension activation to allow users to pre-configure
 * their settings by placing a config file at a predefined location.
 */
export async function autoImportConfig({
	providerSettingsManager,
	contextProxy,
	customModesManager,
	outputChannel,
}: AutoImportOptions): Promise<void> {
	try {
		// Get the auto-import config path from VSCode settings
		const configPath = vscode.workspace.getConfiguration("roo-cline").get<string>("autoImportConfigPath")

		if (!configPath || configPath.trim() === "") {
			outputChannel.appendLine("[AutoImport] No auto-import config path specified, skipping auto-import")
			return
		}

		// Resolve the path (handle ~ for home directory and relative paths)
		const resolvedPath = resolvePath(configPath.trim())
		outputChannel.appendLine(`[AutoImport] Checking for config file at: ${resolvedPath}`)

		// Check if the file exists
		if (!(await fileExistsAtPath(resolvedPath))) {
			outputChannel.appendLine(`[AutoImport] Config file not found at ${resolvedPath}, skipping auto-import`)
			return
		}

		// Attempt to import the configuration
		const result = await importConfigFromPath(resolvedPath, {
			providerSettingsManager,
			contextProxy,
			customModesManager,
		})

		if (result.success) {
			outputChannel.appendLine(`[AutoImport] Successfully imported configuration from ${resolvedPath}`)

			// Show a notification to the user
			vscode.window.showInformationMessage(
				`RooCode configuration automatically imported from ${path.basename(resolvedPath)}`,
			)
		} else {
			outputChannel.appendLine(`[AutoImport] Failed to import configuration: ${result.error}`)

			// Show a warning but don't fail the extension activation
			vscode.window.showWarningMessage(`Failed to auto-import RooCode configuration: ${result.error}`)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`[AutoImport] Unexpected error during auto-import: ${errorMessage}`)

		// Log error but don't fail extension activation
		console.warn("Auto-import config error:", error)
	}
}

/**
 * Resolves a file path, handling home directory expansion and relative paths
 */
function resolvePath(configPath: string): string {
	// Handle home directory expansion
	if (configPath.startsWith("~/")) {
		return path.join(os.homedir(), configPath.slice(2))
	}

	// Handle absolute paths
	if (path.isAbsolute(configPath)) {
		return configPath
	}

	// Handle relative paths (relative to home directory for safety)
	return path.join(os.homedir(), configPath)
}

/**
 * Imports configuration from a specific file path
 * This is similar to the existing importSettings function but works with a file path
 * instead of showing a file dialog
 */
async function importConfigFromPath(
	filePath: string,
	{ providerSettingsManager, contextProxy, customModesManager }: Omit<AutoImportOptions, "outputChannel">,
): Promise<{ success: boolean; error?: string }> {
	const schema = z.object({
		providerProfiles: providerProfilesSchema,
		globalSettings: globalSettingsSchema.optional(),
	})

	try {
		const previousProviderProfiles = await providerSettingsManager.export()

		const data = JSON.parse(await fs.readFile(filePath, "utf-8"))
		const { providerProfiles: newProviderProfiles, globalSettings = {} } = schema.parse(data)

		const providerProfiles = {
			currentApiConfigName: newProviderProfiles.currentApiConfigName,
			apiConfigs: {
				...previousProviderProfiles.apiConfigs,
				...newProviderProfiles.apiConfigs,
			},
			modeApiConfigs: {
				...previousProviderProfiles.modeApiConfigs,
				...newProviderProfiles.modeApiConfigs,
			},
		}

		await Promise.all(
			(globalSettings.customModes ?? []).map((mode) => customModesManager.updateCustomMode(mode.slug, mode)),
		)

		await providerSettingsManager.import(newProviderProfiles)
		await contextProxy.setValues(globalSettings)

		// Set the current provider
		const currentProviderName = providerProfiles.currentApiConfigName
		const currentProvider = providerProfiles.apiConfigs[currentProviderName]
		contextProxy.setValue("currentApiConfigName", currentProviderName)

		if (currentProvider) {
			contextProxy.setProviderSettings(currentProvider)
		}

		contextProxy.setValue("listApiConfigMeta", await providerSettingsManager.listConfig())

		return { success: true }
	} catch (e) {
		let error = "Unknown error"

		if (e instanceof ZodError) {
			error = e.issues.map((issue) => `[${issue.path.join(".")}]: ${issue.message}`).join("\n")
			TelemetryService.instance.captureSchemaValidationError({ schemaName: "AutoImport", error: e })
		} else if (e instanceof Error) {
			error = e.message
		}

		return { success: false, error }
	}
}
