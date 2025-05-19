import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import { z } from "zod"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"

const ItemInstalledMetadataSchema = z.object({
	version: z.string(),
	modes: z.array(z.string()).optional(),
	mcps: z.array(z.string()).optional(),
	files: z.array(z.string()).optional(),
})
export type ItemInstalledMetadata = z.infer<typeof ItemInstalledMetadataSchema>

const ScopeInstalledMetadataSchema = z.record(ItemInstalledMetadataSchema)
export type ScopeInstalledMetadata = z.infer<typeof ScopeInstalledMetadataSchema>

// Full metadata structure
export interface FullInstallatedMetadata {
	project: ScopeInstalledMetadata
	global: ScopeInstalledMetadata
}

/**
 * Manages installed marketplace item metadata for both project and global scopes.
 */
export class InstalledMetadataManager {
	public fullMetadata: FullInstallatedMetadata = {
		project: {},
		global: {},
	}

	constructor(private readonly context: vscode.ExtensionContext) {}

	/**
	 * Loads and validates metadata from a YAML file at the given path.
	 *
	 * Returns an empty object if the file doesn't exist or is invalid.
	 *
	 * Throws errors for issues other than file not found or validation errors.
	 */
	private async loadMetadataFile(filePath: string): Promise<ScopeInstalledMetadata> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const data = yaml.load(content)

			const validationResult = ScopeInstalledMetadataSchema.safeParse(data)

			if (validationResult.success) {
				return validationResult.data
			} else {
				console.warn(
					`InstalledMetadataManager: Invalid metadata structure in ${filePath}. Validation errors:`,
					validationResult.error.flatten(),
				)
				return {} // Return empty for validation errors
			}
		} catch (error: any) {
			if (error.code === "ENOENT") {
				return {} // File not found is expected
			}

			// Re-throw unexpected errors (e.g., permissions issues, YAML parsing errors)
			console.error(`InstalledMetadataManager: Error reading or parsing metadata file ${filePath}:`, error)
			throw error
		}
	}

	/**
	 * Reloads project-specific installed metadata from .roo/.marketplace/metadata.yml.
	 */
	async reloadProject(): Promise<ScopeInstalledMetadata> {
		const metadataPath = await this.getMetadataFilePath("project")
		if (!metadataPath) {
			this.fullMetadata.project = {}
		} else {
			try {
				this.fullMetadata.project = await this.loadMetadataFile(metadataPath)
				console.debug("Project metadata reloaded:", this.fullMetadata.project)
			} catch (error) {
				console.error("InstalledMetadataManager: Failed to reload project metadata:", error)
				this.fullMetadata.project = {} // Reset on load failure
			}
		}
		return this.fullMetadata.project
	}

	/**
	 * Reloads global installed metadata from the extension's global storage.
	 */
	async reloadGlobal(): Promise<ScopeInstalledMetadata> {
		const metadataPath = await this.getMetadataFilePath("global")
		if (!metadataPath) {
			this.fullMetadata.global = {}
		} else {
			try {
				this.fullMetadata.global = await this.loadMetadataFile(metadataPath)
				console.debug("Global metadata reloaded:", this.fullMetadata.global)
			} catch (error) {
				console.error("InstalledMetadataManager: Failed to reload global metadata:", error)
				this.fullMetadata.global = {} // Reset on load failure
			}
		}
		return this.fullMetadata.global
	}

	/**
	 * Gets the metadata for a specific installed item.
	 * @param scope The scope ('project' or 'global')
	 * @param itemId The ID of the item
	 * @returns The item's metadata or undefined if not found.
	 */
	getInstalledItem(scope: "project" | "global", itemId: string): ItemInstalledMetadata | undefined {
		return this.fullMetadata[scope]?.[itemId]
	}

	/**
	 * Gets the file path for the metadata file based on the scope.
	 * @param scope The scope ('project' or 'global')
	 * @returns The full file path or undefined if scope is project and no workspace is open.
	 */
	private async getMetadataFilePath(scope: "project" | "global"): Promise<string | undefined> {
		if (scope === "project") {
			if (!vscode.workspace.workspaceFolders?.length) {
				console.error("InstalledMetadataManager: Cannot get project metadata path, no workspace folder open.")
				return undefined
			}
			const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath
			return path.join(workspaceFolder, ".roo", ".marketplace", "metadata.yml")
		} else {
			// Global scope
			try {
				const globalSettingsPath = await ensureSettingsDirectoryExists(this.context)
				return path.join(globalSettingsPath, ".marketplace", "metadata.yml")
			} catch (error) {
				console.error("InstalledMetadataManager: Failed to get global settings directory path:", error)
				return undefined
			}
		}
	}

	/**
	 * Saves the metadata for a given scope to its corresponding YAML file.
	 *
	 * Throws an error if the file path cannot be determined or if saving fails.
	 *
	 * @param scope The scope ('project' or 'global')
	 * @param metadata The metadata object to save.
	 */
	private async saveMetadataFile(scope: "project" | "global", metadata: ScopeInstalledMetadata): Promise<void> {
		const filePath = await this.getMetadataFilePath(scope)
		if (!filePath) {
			throw new Error(`InstalledMetadataManager: Could not determine metadata file path for scope '${scope}'.`)
		}

		try {
			// Ensure the directory exists
			await fs.mkdir(path.dirname(filePath), { recursive: true })

			// Serialize metadata to YAML
			const yamlContent = yaml.dump(metadata)

			// Write to file
			await fs.writeFile(filePath, yamlContent, "utf-8")
			console.debug(`InstalledMetadataManager: Metadata saved successfully to ${filePath}`)
		} catch (error) {
			console.error(`InstalledMetadataManager: Error saving metadata file ${filePath}:`, error)
			throw error // Re-throw save errors
		}
	}

	/**
	 * Adds or updates metadata for an installed item and saves it.
	 * @param scope The scope ('project' or 'global')
	 * @param itemId The ID of the item
	 * @param details The metadata details of the item
	 */
	async addInstalledItem(scope: "project" | "global", itemId: string, details: ItemInstalledMetadata): Promise<void> {
		// Add/update the item
		this.fullMetadata[scope][itemId] = details

		// Save the updated metadata for the entire scope
		await this.saveMetadataFile(scope, this.fullMetadata[scope])
		console.log(`Installed item added/updated: ${scope}/${itemId}`)
	}

	/**
	 * Removes metadata for an installed item and saves the changes.
	 * @param scope The scope ('project' or 'global')
	 * @param itemId The ID of the item
	 */
	async removeInstalledItem(scope: "project" | "global", itemId: string): Promise<void> {
		// Check if item exists
		if (this.fullMetadata[scope]?.[itemId]) {
			delete this.fullMetadata[scope][itemId]

			// Save the updated metadata
			await this.saveMetadataFile(scope, this.fullMetadata[scope])
			console.log(`Installed item removed: ${scope}/${itemId}`)
		} else {
			console.warn(`InstalledMetadataManager: Item not found for removal: ${scope}/${itemId}`)
		}
	}
}
