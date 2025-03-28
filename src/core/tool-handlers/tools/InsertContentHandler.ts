import * as path from "path"
import * as fs from "fs/promises"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { fileExistsAtPath } from "../../../utils/fs"
import { insertGroups } from "../../diff/insert-groups" // Assuming this path is correct
import { telemetryService } from "../../../services/telemetry/TelemetryService"
import delay from "delay"

// Define the structure expected in the 'operations' JSON string
interface InsertOperation {
	start_line: number
	content: string
}

export class InsertContentHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
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
		if (!this.toolUse.params.operations) {
			throw new Error("Missing required parameter 'operations'")
		}
		// JSON format validation happens in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		if (!relPath) return // Need path for message

		// Using "appliedDiff" as the tool type for UI consistency, as per original code
		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("InsertContentHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relPath = this.toolUse.params.path
		const operationsJson = this.toolUse.params.operations

		// --- Parameter Validation ---
		if (!relPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("insert_content", "path"),
			)
			return
		}
		if (!operationsJson) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("insert_content", "operations"),
			)
			return
		}

		let parsedOperations: InsertOperation[]
		try {
			parsedOperations = JSON.parse(operationsJson)
			if (!Array.isArray(parsedOperations)) {
				throw new Error("Operations must be an array")
			}
			// Basic validation of operation structure
			if (!parsedOperations.every((op) => typeof op.start_line === "number" && typeof op.content === "string")) {
				throw new Error("Each operation must have a numeric 'start_line' and a string 'content'.")
			}
		} catch (error: any) {
			this.cline.consecutiveMistakeCount++
			await this.cline.say("error", `Failed to parse operations JSON: ${error.message}`)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(`Invalid operations JSON format: ${error.message}`),
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

		// --- Apply Insertions ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful parameter validation

			const fileContent = await fs.readFile(absolutePath, "utf8")
			this.cline.diffViewProvider.editType = "modify" // insert_content always modifies
			this.cline.diffViewProvider.originalContent = fileContent
			const lines = fileContent.split("\n")

			// Map parsed operations to the format expected by insertGroups
			const insertGroupsOps = parsedOperations.map((elem) => ({
				index: elem.start_line - 1, // Convert 1-based line number to 0-based index
				elements: elem.content.split("\n"),
			}))

			const updatedContent = insertGroups(lines, insertGroupsOps).join("\n")

			// --- Show Diff Preview ---
			// Using "appliedDiff" as the tool type for UI consistency
			const sharedMessageProps: ClineSayTool = {
				tool: "appliedDiff",
				path: getReadablePath(this.cline.cwd, relPath),
			}

			// Ensure diff view is open before proceeding (Remove isEditing check and console logs)
			await this.cline.diffViewProvider.open(relPath) // Ensures editor is open

			const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)

			if (!diff) {
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolResult(`No changes needed for '${relPath}'`),
				)
				await this.cline.diffViewProvider.reset() // Reset even if no changes
				return
			}

			await this.cline.diffViewProvider.update(updatedContent, true) // Final update with changes
			this.cline.diffViewProvider.scrollToFirstDiff() // Scroll after final update

			// --- Ask for Approval ---
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				diff,
			} satisfies ClineSayTool)

			// Original code used a simple .then() for approval, replicating that for now
			// Consider using askApprovalHelper if consistent behavior is desired
			const didApprove = await this.cline
				.ask("tool", completeMessage, false)
				.then((response) => response.response === "yesButtonClicked")
				.catch(() => false) // Assume rejection on error

			if (!didApprove) {
				await this.cline.diffViewProvider.revertChanges()
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolResult("Changes were rejected by the user."),
				)
				return
			}

			// --- Save Changes ---
			const { newProblemsMessage, userEdits, finalContent } = await this.cline.diffViewProvider.saveChanges()
			this.cline.didEditFile = true

			let resultMessage: string
			if (userEdits) {
				const userFeedbackDiff = JSON.stringify({
					tool: "appliedDiff", // Consistent tool type
					path: getReadablePath(this.cline.cwd, relPath),
					diff: userEdits,
				} satisfies ClineSayTool)
				await this.cline.say("user_feedback_diff", userFeedbackDiff)
				resultMessage =
					`The user made the following updates to your content:\n\n${userEdits}\n\n` +
					`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath}. Here is the full, updated content of the file:\n\n` +
					`<final_file_content path="${relPath}">\n${finalContent}\n</final_file_content>\n\n` + // Note: Original code didn't addLineNumbers here
					`Please note:\n` +
					`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
					`2. Proceed with the task using this updated file content as the new baseline.\n` +
					`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
					`${newProblemsMessage}`
			} else {
				resultMessage = `The content was successfully inserted in ${relPath}.${newProblemsMessage}`
			}

			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultMessage))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			await this.cline.handleErrorHelper(this.toolUse, "insert content", error)
		} finally {
			// Always reset diff provider state
			await this.cline.diffViewProvider.reset()
		}
	}
}
