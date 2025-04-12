import * as vscode from "vscode"

/**
 * Migrates old subtasks setting to new subtaskCreation and subtaskCompletion settings.
 *
 * TODO: Remove this migration code in September 2025 (6 months after implementation)
 */
export async function migrateSubtasksSettings(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	// Old and new setting keys
	const subtasksKey = "alwaysAllowSubtasks"
	const subtaskCreationKey = "alwaysAllowSubtaskCreation"
	const subtaskCompletionKey = "alwaysAllowSubtaskCompletion"

	try {
		// Get old value
		const oldValue = await context.globalState.get(subtasksKey)

		if (oldValue !== undefined && typeof oldValue === "boolean") {
			// Update new settings
			await Promise.all([
				context.globalState.update(subtaskCreationKey, oldValue),
				context.globalState.update(subtaskCompletionKey, oldValue),
			])

			// Schedule cleanup
			setTimeout(async () => {
				try {
					await context.globalState.update(subtasksKey, undefined)
					outputChannel.appendLine("Migrated subtasks settings")
				} catch (error) {
					outputChannel.appendLine(`Failed to delete old subtasks setting: ${error}`)
				}
			}, 0)
		}
	} catch (error) {
		outputChannel.appendLine(`Migrating subtasks settings failed: ${error}`)
	}
}
