import { Task } from "../../core/task/Task"

/**
 * Interface for editing providers (DiffViewProvider, FileWriter, etc.)
 * This allows tools to work with different editing strategies seamlessly
 */
export interface IEditingProvider {
	// Properties to store the results of saveChanges
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined

	/**
	 * Initializes the editing provider
	 */
	initialize(): Promise<void>

	/**
	 * Prepares for editing the given relative path file
	 * @param relPath The relative file path to open/prepare for editing
	 * @param viewColumn Optional view column for diff-based editing (ignored by file-based editing)
	 */
	open(relPath: string, viewColumn?: any): Promise<void>

	/**
	 * Updates the content being edited
	 * @param content The content to apply
	 * @param isFinal Whether this is the final update
	 */
	update(content: string, isFinal: boolean): Promise<void>

	/**
	 * Finalizes the changes and returns diagnostics information
	 */
	saveChanges(): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}>

	/**
	 * Formats a standardized XML response for file write operations
	 * @param task The current task context for sending user feedback
	 * @param cwd Current working directory for path resolution
	 * @param isNewFile Whether this is a new file or an existing file being modified
	 * @returns Formatted XML response message
	 */
	pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string>

	/**
	 * Reverts changes (cancels the editing operation)
	 */
	revertChanges(): Promise<void>

	/**
	 * Resets the provider state
	 */
	reset(): Promise<void>

	/**
	 * Resets the provider state with listeners cleanup
	 */
	resetWithListeners(): void

	/**
	 * Scrolls to first diff (diff providers only, no-op for file providers)
	 */
	scrollToFirstDiff(): void

	/**
	 * Disables auto-focus after user interaction (diff providers only, no-op for file providers)
	 */
	disableAutoFocusAfterUserInteraction?(): void
}
