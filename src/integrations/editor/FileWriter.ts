import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import stripBom from "strip-bom"
import { XMLBuilder } from "fast-xml-parser"

import { createDirectoriesForFile } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"
import { formatResponse } from "../../core/prompts/responses"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../diagnostics"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { Task } from "../../core/task/Task"
import { IEditingProvider } from "./IEditingProvider"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import delay from "delay"

interface FileWriterSettings {
	fileBasedEditing: boolean
}

/**
 * FileWriter provides direct file-system editing without diff views.
 * It mirrors the API of DiffViewProvider for seamless integration.
 */
export class FileWriter implements IEditingProvider {
	// Properties to store the results of saveChanges
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined
	private createdDirs: string[] = []
	private relPath?: string
	private newContent?: string
	private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []

	constructor(private cwd: string) {}

	/**
	 * Reads file writing settings from VSCode configuration
	 */
	private async _readFileWriterSettings(): Promise<FileWriterSettings> {
		const config = vscode.workspace.getConfiguration("roo-cline")
		const fileBasedEditing = config.get<boolean>("fileBasedEditing", false)

		return {
			fileBasedEditing,
		}
	}

	/**
	 * Prepares for editing the given relative path file
	 * @param relPath The relative file path to prepare for editing
	 */
	async open(relPath: string): Promise<void> {
		this.relPath = relPath
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		// Get diagnostics before editing the file
		this.preDiagnostics = vscode.languages.getDiagnostics()

		// Check if file exists to set edit type
		try {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
			this.editType = "modify"
		} catch (error) {
			this.originalContent = ""
			this.editType = "create"
		}

		// For new files, create any necessary directories
		if (this.editType === "create") {
			this.createdDirs = await createDirectoriesForFile(absolutePath)
		}
	}

	/**
	 * Updates the file content (writes directly to file system)
	 * @param accumulatedContent The content to write
	 * @param isFinal Whether this is the final update
	 */
	async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.relPath) {
			throw new Error("Required values not set")
		}

		this.newContent = accumulatedContent
		const absolutePath = path.resolve(this.cwd, this.relPath)

		if (isFinal) {
			// Preserve empty last line if original content had one
			const hasEmptyLastLine = this.originalContent?.endsWith("\n")

			if (hasEmptyLastLine && !accumulatedContent.endsWith("\n")) {
				accumulatedContent += "\n"
			}

			// Write the final content directly to file
			await fs.writeFile(absolutePath, this.stripAllBOMs(accumulatedContent), "utf-8")
		}
	}

	/**
	 * Finalizes the file changes and returns diagnostics information
	 * @param diagnosticsEnabled Whether to enable diagnostics (default: true)
	 * @param writeDelayMs Delay in milliseconds before writing changes (default: 1000)
	 */
	async saveChanges(
		diagnosticsEnabled: boolean = true,
		writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
	): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}> {
		if (!this.relPath || !this.newContent) {
			return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
		}

		const absolutePath = path.resolve(this.cwd, this.relPath)

		// Read the actual file content to check if it matches what we wrote
		const finalContent = await fs.readFile(absolutePath, "utf-8")

		// Getting diagnostics before and after the file edit is a better approach than
		// automatically tracking problems in real-time. This method ensures we only
		// report new problems that are a direct result of this specific edit.
		// Since these are new problems resulting from Roo's edit, we know they're
		// directly related to the work he's doing. This eliminates the risk of Roo
		// going off-task or getting distracted by unrelated issues, which was a problem
		// with the previous auto-debug approach. Some users' machines may be slow to
		// update diagnostics, so this approach provides a good balance between automation
		// and avoiding potential issues where Roo might get stuck in loops due to
		// outdated problem information. If no new problems show up by the time the user
		// accepts the changes, they can always debug later using the '@problems' mention.
		// This way, Roo only becomes aware of new problems resulting from his edits
		// and can address them accordingly. If problems don't change immediately after
		// applying a fix, won't be notified, which is generally fine since the
		// initial fix is usually correct and it may just take time for linters to catch up.

		let newProblemsMessage = ""

		if (diagnosticsEnabled) {
			// Add configurable delay to allow linters time to process and clean up issues
			// like unused imports (especially important for Go and other languages)
			// Ensure delay is non-negative
			const safeDelayMs = Math.max(0, writeDelayMs)

			try {
				await delay(safeDelayMs)
			} catch (error) {
				// Log error but continue - delay failure shouldn't break the save operation
				console.warn(`Failed to apply write delay: ${error}`)
			}

			const postDiagnostics = vscode.languages.getDiagnostics()

			const newProblems = await diagnosticsToProblemsString(
				getNewDiagnostics(this.preDiagnostics, postDiagnostics),
				[
					vscode.DiagnosticSeverity.Error, // only including errors since warnings can be distracting (if user wants to fix warnings they can use the @problems mention)
				],
				this.cwd,
			) // Will be empty string if no errors.

			newProblemsMessage =
				newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""
		}

		// In file-based editing, there should be no user edits since we write directly
		// But we check if the final content differs from what we intended to write
		const normalizedNewContent = this.newContent.replace(/\r\n|\n/g, "\n")
		const normalizedFinalContent = finalContent.replace(/\r\n|\n/g, "\n").trimEnd()

		if (normalizedFinalContent !== normalizedNewContent) {
			// This shouldn't happen in normal file-based editing, but handle it just in case
			const userEdits = formatResponse.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedNewContent,
				normalizedFinalContent,
			)

			this.newProblemsMessage = newProblemsMessage
			this.userEdits = userEdits

			return { newProblemsMessage, userEdits, finalContent: normalizedFinalContent }
		} else {
			this.newProblemsMessage = newProblemsMessage
			this.userEdits = undefined

			return { newProblemsMessage, userEdits: undefined, finalContent: normalizedFinalContent }
		}
	}

	/**
	 * Formats a standardized XML response for file write operations
	 * @param task The current task context for sending user feedback
	 * @param cwd Current working directory for path resolution
	 * @param isNewFile Whether this is a new file or an existing file being modified
	 * @returns Formatted message and say object for UI feedback
	 */
	async pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string> {
		if (!this.relPath) {
			throw new Error("No file path available in FileWriter")
		}

		// Only send user_feedback_diff if userEdits exists (shouldn't happen in file-based editing)
		if (this.userEdits) {
			// Create say object for UI feedback
			const say: ClineSayTool = {
				tool: isNewFile ? "newFileCreated" : "editedExistingFile",
				path: getReadablePath(cwd, this.relPath),
				diff: this.userEdits,
			}

			// Send the user feedback
			await task.say("user_feedback_diff", JSON.stringify(say))
		}

		// Build XML response
		const xmlObj = {
			file_write_result: {
				path: this.relPath,
				operation: isNewFile ? "created" : "modified",
				user_edits: this.userEdits ? this.userEdits : undefined,
				problems: this.newProblemsMessage || undefined,
				notice: {
					i: [
						"You do not need to re-read the file, as you have seen all changes",
						"Proceed with the task using these changes as the new baseline.",
						...(this.userEdits
							? [
									"If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.",
								]
							: []),
					],
				},
			},
		}

		const builder = new XMLBuilder({
			format: true,
			indentBy: "",
			suppressEmptyNode: true,
			processEntities: false,
			tagValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
			attributeValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
		})

		return builder.build(xmlObj)
	}

	/**
	 * Reverts changes (deletes new files, restores original content for modified files)
	 */
	async revertChanges(): Promise<void> {
		if (!this.relPath) {
			return
		}

		const fileExists = this.editType === "modify"
		const absolutePath = path.resolve(this.cwd, this.relPath)

		if (!fileExists) {
			// Delete the newly created file
			try {
				await fs.unlink(absolutePath)
			} catch (error) {
				// File might not exist, ignore error
			}

			// Remove only the directories we created, in reverse order
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				try {
					await fs.rmdir(this.createdDirs[i])
				} catch (error) {
					// Directory might not be empty or not exist, ignore error
				}
			}
		} else {
			// Restore original content
			await fs.writeFile(absolutePath, this.stripAllBOMs(this.originalContent ?? ""), "utf-8")
		}

		// Reset state
		this.reset()
	}

	/**
	 * Strips all BOM characters from input string
	 */
	private stripAllBOMs(input: string): string {
		let result = input
		let previous

		do {
			previous = result
			result = stripBom(result)
		} while (result !== previous)

		return result
	}

	/**
	 * Resets the FileWriter state
	 */
	async reset(): Promise<void> {
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.newContent = undefined
		this.createdDirs = []
		this.relPath = undefined
		this.preDiagnostics = []
		this.newProblemsMessage = undefined
		this.userEdits = undefined
	}

	async scrollToFirstDiff(): Promise<void> {
		// No-op for FileWriter, as it doesn't handle diffs
		return
	}
}
