import * as path from "path"
import * as fs from "fs/promises"
import { ToolUse } from "../../assistant-message" // Use generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool, ToolProgressStatus } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { fileExistsAtPath } from "../../../utils/fs"
import { addLineNumbers } from "../../../integrations/misc/extract-text"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class ApplyDiffHandler extends ToolUseHandler {
	// protected override toolUse: ApplyDiffToolUse; // Removed override
	// Store consecutive mistake count specific to apply_diff for each file
	private consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
		// this.toolUse = toolUse as ApplyDiffToolUse; // Removed type assertion
		// Note: consecutiveMistakeCountForApplyDiff needs to be managed.
		// If Cline instance is long-lived, this map might grow.
		// Consider if this state should live on Cline or be handled differently.
		// For now, keeping it within the handler instance.
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.path) {
			throw new Error("Missing required parameter 'path'")
		}
		if (!this.toolUse.params.diff) {
			throw new Error("Missing required parameter 'diff'")
		}
		if (!this.toolUse.params.start_line) {
			throw new Error("Missing required parameter 'start_line'")
		}
		if (!this.toolUse.params.end_line) {
			throw new Error("Missing required parameter 'end_line'")
		}
		// start_line and end_line content validation happens in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		if (!relPath) return // Need path for message

		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
		}

		let toolProgressStatus: ToolProgressStatus | undefined
		// Assuming diffStrategy might have progress reporting capabilities
		if (this.cline.diffStrategy && this.cline.diffStrategy.getProgressStatus) {
			toolProgressStatus = this.cline.diffStrategy.getProgressStatus(this.toolUse)
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		try {
			await this.cline.ask("tool", partialMessage, true, toolProgressStatus)
		} catch (error) {
			console.warn("ApplyDiffHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relPath = this.toolUse.params.path
		const diffContent = this.toolUse.params.diff
		const startLineStr = this.toolUse.params.start_line
		const endLineStr = this.toolUse.params.end_line

		// --- Parameter Validation ---
		if (!relPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("apply_diff", "path"),
			)
			return
		}
		if (!diffContent) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("apply_diff", "diff"),
			)
			return
		}
		if (!startLineStr) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("apply_diff", "start_line"),
			)
			return
		}
		if (!endLineStr) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("apply_diff", "end_line"),
			)
			return
		}

		let startLine: number | undefined = undefined
		let endLine: number | undefined = undefined

		try {
			startLine = parseInt(startLineStr)
			endLine = parseInt(endLineStr)
			if (isNaN(startLine) || isNaN(endLine) || startLine < 1 || endLine < 1) {
				throw new Error("start_line and end_line must be positive integers.")
			}
			if (startLine > endLine) {
				throw new Error("start_line cannot be greater than end_line.")
			}
		} catch (error) {
			this.cline.consecutiveMistakeCount++
			await this.cline.say("error", `Invalid line numbers: ${error.message}`)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(`Invalid line numbers: ${error.message}`),
			)
			return
		}

		// --- Access Validation ---
		const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await this.cline.say("rooignore_error", relPath)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(formatResponse.rooIgnoreError(relPath)),
			)
			return
		}

		// --- File Existence Check ---
		const absolutePath = path.resolve(this.cline.cwd, relPath)
		const fileExists = await fileExistsAtPath(absolutePath)
		if (!fileExists) {
			this.cline.consecutiveMistakeCount++
			const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
			await this.cline.say("error", formattedError)
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(formattedError))
			return
		}

		// --- Apply Diff ---
		try {
			const originalContent = await fs.readFile(absolutePath, "utf-8")

			// Assuming diffStrategy is available on Cline instance
			const diffResult = (await this.cline.diffStrategy?.applyDiff(
				originalContent,
				diffContent,
				startLine, // Already parsed
				endLine, // Already parsed
			)) ?? { success: false, error: "No diff strategy available" } // Default error if no strategy

			// --- Handle Diff Failure ---
			if (!diffResult.success) {
				this.cline.consecutiveMistakeCount++
				const currentCount = (this.consecutiveMistakeCountForApplyDiff.get(relPath) || 0) + 1
				this.consecutiveMistakeCountForApplyDiff.set(relPath, currentCount)

				let formattedError = ""
				let partResults = "" // To accumulate partial failure messages

				if (diffResult.failParts && diffResult.failParts.length > 0) {
					for (const failPart of diffResult.failParts) {
						if (failPart.success) continue
						const errorDetails = failPart.details ? JSON.stringify(failPart.details, null, 2) : ""
						const partError = `<error_details>\n${failPart.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
						partResults += partError // Accumulate errors
					}
					formattedError = partResults || `Unable to apply some parts of the diff to file: ${absolutePath}` // Use accumulated or generic message
				} else {
					const errorDetails = diffResult.details ? JSON.stringify(diffResult.details, null, 2) : ""
					formattedError = `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${diffResult.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
				}

				if (currentCount >= 2) {
					// Show error in UI only on second consecutive failure for the same file
					await this.cline.say("error", formattedError)
				}
				await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(formattedError))
				return // Stop processing on failure
			}

			// --- Diff Success ---
			this.cline.consecutiveMistakeCount = 0
			this.consecutiveMistakeCountForApplyDiff.delete(relPath) // Reset count for this file

			// --- Show Diff Preview ---
			this.cline.diffViewProvider.editType = "modify"
			await this.cline.diffViewProvider.open(relPath)
			await this.cline.diffViewProvider.update(diffResult.content, true)
			await this.cline.diffViewProvider.scrollToFirstDiff()

			// --- Ask for Approval ---
			const sharedMessageProps: ClineSayTool = {
				tool: "appliedDiff",
				path: getReadablePath(this.cline.cwd, relPath),
			}
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				diff: diffContent, // Show the raw diff provided by the AI
			} satisfies ClineSayTool)

			let toolProgressStatus: ToolProgressStatus | undefined
			if (this.cline.diffStrategy && this.cline.diffStrategy.getProgressStatus) {
				toolProgressStatus = this.cline.diffStrategy.getProgressStatus(this.toolUse, diffResult)
			}

			const didApprove = await this.cline.askApprovalHelper(
				this.toolUse,
				"tool",
				completeMessage,
				toolProgressStatus,
			)
			if (!didApprove) {
				await this.cline.diffViewProvider.revertChanges()
				// pushToolResult handled by askApprovalHelper
				return
			}

			// --- Save Changes ---
			const { newProblemsMessage, userEdits, finalContent } = await this.cline.diffViewProvider.saveChanges()
			this.cline.didEditFile = true

			let partFailHint = ""
			if (diffResult.failParts && diffResult.failParts.length > 0) {
				partFailHint = `\n\nWarning: Unable to apply all diff parts. Use <read_file> to check the latest file version and re-apply remaining diffs if necessary.`
			}

			let resultMessage: string
			if (userEdits) {
				await this.cline.say(
					"user_feedback_diff",
					JSON.stringify({
						tool: "appliedDiff", // Keep consistent tool type
						path: getReadablePath(this.cline.cwd, relPath),
						diff: userEdits,
					} satisfies ClineSayTool),
				)
				resultMessage =
					`The user made the following updates to your content:\n\n${userEdits}\n\n` +
					`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath}. Here is the full, updated content of the file, including line numbers:\n\n` +
					`<final_file_content path="${relPath}">\n${addLineNumbers(finalContent || "")}\n</final_file_content>\n\n` +
					`Please note:\n` +
					`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
					`2. Proceed with the task using this updated file content as the new baseline.\n` +
					`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
					`${newProblemsMessage}${partFailHint}`
			} else {
				resultMessage = `Changes successfully applied to ${relPath}.${newProblemsMessage}${partFailHint}`
			}

			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultMessage))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			await this.cline.handleErrorHelper(this.toolUse, "applying diff", error)
			// Ensure changes are reverted if an error occurs during saveChanges or other steps
			await this.cline.diffViewProvider.revertChanges()
		} finally {
			// Always reset diff provider state
			await this.cline.diffViewProvider.reset()
		}
	}
}
