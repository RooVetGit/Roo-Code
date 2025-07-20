import { DiffViewProvider } from "./DiffViewProvider"
import { FileWriter } from "./FileWriter"
import { IEditingProvider } from "./IEditingProvider"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { Experiments } from "@roo-code/types"

/**
 * Factory for creating the appropriate editing provider based on user settings
 */
export class EditingProviderFactory {
	/**
	 * Creates an editing provider based on current VSCode settings
	 * @param cwd The current working directory
	 * @param experimentConfig The experiments configuration to check for feature flags
	 * @returns The appropriate editing provider (DiffViewProvider or FileWriter)
	 */
	static createEditingProvider(cwd: string, experimentConfig: Experiments = {}): IEditingProvider {
		const fileBasedEditing = experiments.isEnabled(experimentConfig, EXPERIMENT_IDS.FILE_BASED_EDITING)

		if (fileBasedEditing) {
			return new FileWriter(cwd)
		} else {
			return new DiffViewProvider(cwd)
		}
	}

	/**
	 * Resets the current editing provider and creates a new one based on the current working directory
	 * @param cwd The current working directory
	 * @param editingProvider The current editing provider instance to reset
	 * @param experimentConfig The experiments configuration to check for feature flags
	 * @returns A new instance of the appropriate editing provider
	 */
	static resetAndCreateNewEditingProvider(
		cwd: string,
		editingProvider: IEditingProvider,
		experimentConfig: Experiments,
	): IEditingProvider {
		// Reset the current editing provider
		editingProvider.reset()

		// Create a new instance of the appropriate provider
		return this.createEditingProvider(cwd, experimentConfig)
	}
}
