import * as vscode from "vscode"
import { DiffViewProvider } from "./DiffViewProvider"
import { FileWriter } from "./FileWriter"
import { IEditingProvider } from "./IEditingProvider"

/**
 * Factory for creating the appropriate editing provider based on user settings
 */
export class EditingProviderFactory {
	/**
	 * Creates an editing provider based on current VSCode settings
	 * @param cwd The current working directory
	 * @returns The appropriate editing provider (DiffViewProvider or FileWriter)
	 */
	static createEditingProvider(cwd: string): IEditingProvider {
		const config = vscode.workspace.getConfiguration("roo-cline")
		const fileBasedEditing = config.get<boolean>("fileBasedEditing", false)

		if (fileBasedEditing) {
			return new FileWriter(cwd)
		} else {
			return new DiffViewProvider(cwd)
		}
	}

	/**
	 * Checks if file-based editing is currently enabled
	 * @returns True if file-based editing is enabled, false otherwise
	 */
	static isFileBasedEditingEnabled(): boolean {
		const config = vscode.workspace.getConfiguration("roo-cline")
		return config.get<boolean>("fileBasedEditing", false)
	}
}
