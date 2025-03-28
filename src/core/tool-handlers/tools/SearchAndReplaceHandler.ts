import * as path from "path"
import * as fs from "fs/promises"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { fileExistsAtPath } from "../../../utils/fs"
import { addLineNumbers } from "../../../integrations/misc/extract-text"
import { telemetryService } from "../../../services/telemetry/TelemetryService"
// import { escapeRegExp } from "../../../utils/string"; // Removed incorrect import

// Define the structure expected in the 'operations' JSON string
interface SearchReplaceOperation {
	search: string
	replace: string
	start_line?: number
	end_line?: number
	use_regex?: boolean
	ignore_case?: boolean
	regex_flags?: string
}

export class SearchAndReplaceHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	// Helper function copied from Cline.ts
	private static escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
		// JSON format and content validation happens in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		const operationsJson = this.toolUse.params.operations // Keep for potential future partial parsing/validation
		if (!relPath) return // Need path for message

		// Using "appliedDiff" as the tool type for UI consistency
		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
		}

		// Construct partial message for UI update
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			// Could potentially show partial operations if needed, but keep simple for now
			// operations: this.removeClosingTag("operations", operationsJson),
		})

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("SearchAndReplaceHandler: ask for partial update interrupted.", error)
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
				await this.cline.sayAndCreateMissingParamError("search_and_replace", "path"),
			)
			return
		}
		if (!operationsJson) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("search_and_replace", "operations"),
			)
			return
		}

		let parsedOperations: SearchReplaceOperation[]
		try {
			parsedOperations = JSON.parse(operationsJson)
			if (!Array.isArray(parsedOperations)) {
				throw new Error("Operations must be an array")
			}
			// Basic validation of operation structure
			if (!parsedOperations.every((op) => typeof op.search === "string" && typeof op.replace === "string")) {
				throw new Error("Each operation must have string 'search' and 'replace' properties.")
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

		// --- Apply Replacements ---
		try {
			const fileContent = await fs.readFile(absolutePath, "utf-8")
			this.cline.diffViewProvider.editType = "modify" // Always modifies
			this.cline.diffViewProvider.originalContent = fileContent
			let lines = fileContent.split("\n")

			for (const op of parsedOperations) {
				// Determine regex flags, ensuring 'm' for multiline if start/end lines are used
				const baseFlags = op.regex_flags ?? (op.ignore_case ? "gi" : "g")
				// Ensure multiline flag 'm' is present for line-range replacements or if already specified
				const multilineFlags =
					(op.start_line || op.end_line || baseFlags.includes("m")) && !baseFlags.includes("m")
						? baseFlags + "m"
						: baseFlags

				const searchPattern = op.use_regex
					? new RegExp(op.search, multilineFlags)
					: new RegExp(SearchAndReplaceHandler.escapeRegExp(op.search), multilineFlags) // Use static class method

				if (op.start_line || op.end_line) {
					// Line-range replacement
					const startLine = Math.max((op.start_line ?? 1) - 1, 0) // 0-based start index
					const endLine = Math.min((op.end_line ?? lines.length) - 1, lines.length - 1) // 0-based end index

					if (startLine > endLine) {
						console.warn(
							`Search/Replace: Skipping operation with start_line (${op.start_line}) > end_line (${op.end_line})`,
						)
						continue // Skip invalid range
					}

					const beforeLines = lines.slice(0, startLine)
					const afterLines = lines.slice(endLine + 1)
					const targetContent = lines.slice(startLine, endLine + 1).join("\n")
					const modifiedContent = targetContent.replace(searchPattern, op.replace)
					const modifiedLines = modifiedContent.split("\n")
					lines = [...beforeLines, ...modifiedLines, ...afterLines]
				} else {
					// Global replacement
					const fullContent = lines.join("\n")
					const modifiedContent = fullContent.replace(searchPattern, op.replace)
					lines = modifiedContent.split("\n")
				}
			}

			const newContent = lines.join("\n")
			this.cline.consecutiveMistakeCount = 0 // Reset on success

			// --- Show Diff Preview ---
			const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)

			if (!diff) {
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolResult(`No changes needed for '${relPath}'`),
				)
				await this.cline.diffViewProvider.reset()
				return
			}

			await this.cline.diffViewProvider.open(relPath)
			await this.cline.diffViewProvider.update(newContent, true)
			this.cline.diffViewProvider.scrollToFirstDiff()

			// --- Ask for Approval ---
			const sharedMessageProps: ClineSayTool = {
				tool: "appliedDiff", // Consistent UI
				path: getReadablePath(this.cline.cwd, relPath),
			}
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				diff: diff,
			} satisfies ClineSayTool)

			// Use askApprovalHelper for consistency
			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)
			if (!didApprove) {
				await this.cline.diffViewProvider.revertChanges()
				// pushToolResult handled by helper
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
					`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath}. Here is the full, updated content of the file, including line numbers:\n\n` +
					`<final_file_content path="${relPath}">\n${addLineNumbers(finalContent || "")}\n</final_file_content>\n\n` + // Added line numbers for consistency
					`Please note:\n` +
					`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
					`2. Proceed with the task using this updated file content as the new baseline.\n` +
					`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
					`${newProblemsMessage}`
			} else {
				resultMessage = `Changes successfully applied to ${relPath}.${newProblemsMessage}`
			}

			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultMessage))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			await this.cline.handleErrorHelper(this.toolUse, "applying search and replace", error)
		} finally {
			// Always reset diff provider state
			await this.cline.diffViewProvider.reset()
		}
	}
}
