import * as vscode from "vscode"
import { MigrationService } from "../services/checkpoints/MigrationService"

/**
 * Command to migrate checkpoints from the old Git-based system to the new patch-based system
 */
export async function migrateCheckpoints(context: vscode.ExtensionContext) {
	const globalStorageDir = context.globalStorageUri.fsPath

	// Create output channel for logging
	const outputChannel = vscode.window.createOutputChannel("Roo Code Checkpoint Migration")
	outputChannel.show()

	const log = (message: string) => {
		console.log(message)
		outputChannel.appendLine(message)
	}

	// Show progress notification
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "Migrating checkpoints",
			cancellable: false,
		},
		async (progress) => {
			progress.report({ message: "Starting migration..." })

			try {
				// Create migration service
				const migrationService = new MigrationService(globalStorageDir, log)

				// Run migration
				log("Starting checkpoint migration...")
				await migrationService.migrateAllTasks()

				progress.report({ message: "Migration completed" })
				log("Checkpoint migration completed successfully")

				vscode.window.showInformationMessage("Checkpoint migration completed successfully")
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				log(`Error during migration: ${errorMessage}`)

				vscode.window.showErrorMessage(`Checkpoint migration failed: ${errorMessage}`)
			}
		},
	)
}
