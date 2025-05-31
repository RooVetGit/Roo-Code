import path from "path"
import fs from "fs/promises"

import { TelemetryService } from "@roo-code/telemetry"

import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, RemoveClosingTag, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { fileExistsAtPath } from "../../utils/fs"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { parseXml } from "../../utils/xml"

interface DiffOperation {
	path: string
	diff: Array<{
		content: string
		startLine?: number
	}>
}

export async function applyDiffTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const argsXmlTag: string | undefined = block.params.args
	const legacyPath: string | undefined = block.params.path
	const legacyDiffContent: string | undefined = block.params.diff
	const legacyStartLineStr: string | undefined = block.params.start_line

	let operationsMap: Record<string, DiffOperation> = {}
	let usingLegacyParams = false

	// Handle partial message first
	if (block.partial) {
		let filePath = ""
		if (argsXmlTag) {
			const match = argsXmlTag.match(/<file>.*?<path>([^<]+)<\/path>/s)
			if (match) {
				filePath = match[1]
			}
		} else if (legacyPath) {
			// Use legacy path if argsXmlTag is not present for partial messages
			filePath = legacyPath
		}

		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(cline.cwd, filePath),
		}
		const partialMessage = JSON.stringify(sharedMessageProps)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	if (argsXmlTag) {
		// Parse file entries from XML (new way)
		try {
			const parsed = parseXml(argsXmlTag, ["file.diff.content"]) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)

			for (const file of files) {
				if (!file.path || !file.diff) continue

				const filePath = file.path

				// Initialize the operation in the map if it doesn't exist
				if (!operationsMap[filePath]) {
					operationsMap[filePath] = {
						path: filePath,
						diff: [],
					}
				}

				// Handle diff as either array or single element
				const diffs = Array.isArray(file.diff) ? file.diff : [file.diff]

				for (let i = 0; i < diffs.length; i++) {
					const diff = diffs[i]
					let diffContent: string
					let startLine: number | undefined

					diffContent = diff.content
					startLine = diff.start_line ? parseInt(diff.start_line) : undefined

					operationsMap[filePath].diff.push({
						content: diffContent,
						startLine,
					})
				}
			}
		} catch (error) {
			throw new Error(`Failed to parse apply_diff XML: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (legacyPath && typeof legacyDiffContent === "string") {
		// Handle legacy parameters (old way)
		usingLegacyParams = true
		operationsMap[legacyPath] = {
			path: legacyPath,
			diff: [
				{
					content: legacyDiffContent, // Unescaping will be handled later like new diffs
					startLine: legacyStartLineStr ? parseInt(legacyStartLineStr) : undefined,
				},
			],
		}
	} else {
		// Neither new XML args nor old path/diff params are sufficient
		cline.consecutiveMistakeCount++
		cline.recordToolError("apply_diff")
		const errorMsg = await cline.sayAndCreateMissingParamError(
			"apply_diff",
			"args (or legacy 'path' and 'diff' parameters)",
		)
		pushToolResult(errorMsg)
		return
	}

	// If no operations were extracted, bail out
	if (Object.keys(operationsMap).length === 0) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("apply_diff")
		pushToolResult(
			await cline.sayAndCreateMissingParamError(
				"apply_diff",
				usingLegacyParams
					? "legacy 'path' and 'diff' (must be valid and non-empty)"
					: "args (must contain at least one valid file element)",
			),
		)
		return
	}

	// Convert map to array of operations for processing
	const operations = Object.values(operationsMap)
	const sharedMessageProps: ClineSayTool = {
		tool: "appliedDiff",
		path: getReadablePath(cline.cwd, removeClosingTag("path", operations[0].path)),
	}

	try {
		// Process all operations
		const results: string[] = []

		for (const operation of operations) {
			const { path: relPath, diff: diffItems } = operation

			// Verify file access is allowed
			const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
			if (!accessAllowed) {
				await cline.say("rooignore_error", relPath)
				results.push(formatResponse.rooIgnoreError(relPath))
				continue
			}

			// Verify file exists
			const absolutePath = path.resolve(cline.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath)
			if (!fileExists) {
				results.push(`File does not exist at path: ${absolutePath}`)
				continue
			}

			let originalContent = await fs.readFile(absolutePath, "utf-8")
			let successCount = 0
			let formattedError = ""

			// Pre-process all diff items for HTML entity unescaping if needed
			const processedDiffItems = !cline.api.getModel().id.includes("claude")
				? diffItems.map((item) => ({
						...item,
						content: item.content ? unescapeHtmlEntities(item.content) : item.content,
					}))
				: diffItems

			// Apply all diffs at once with the array-based method
			const diffResult = (await cline.diffStrategy?.applyDiff(originalContent, processedDiffItems as any)) ?? {
				success: false,
				error: "No diff strategy available",
			}

			if (!diffResult.success) {
				cline.consecutiveMistakeCount++
				const currentCount = (cline.consecutiveMistakeCountForApplyDiff.get(relPath) || 0) + 1
				cline.consecutiveMistakeCountForApplyDiff.set(relPath, currentCount)

				TelemetryService.instance.captureDiffApplicationError(cline.taskId, currentCount)

				if (diffResult.failParts && diffResult.failParts.length > 0) {
					for (let i = 0; i < diffResult.failParts.length; i++) {
						const failPart = diffResult.failParts[i]
						if (failPart.success) {
							continue
						}

						const errorDetails = failPart.details ? JSON.stringify(failPart.details, null, 2) : ""
						formattedError += `Error applying diff ${i + 1} to ${relPath}: ${failPart.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n\n`
					}
				} else {
					const errorDetails = diffResult.details ? JSON.stringify(diffResult.details, null, 2) : ""
					formattedError += `Unable to apply diffs to file: ${absolutePath}\n${diffResult.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n\n`
				}
			} else {
				// Get the content from the result and update success count
				originalContent = diffResult.content || originalContent
				successCount = diffItems.length - (diffResult.failParts?.length || 0)
			}

			// If no diffs were successfully applied, continue to next file
			if (successCount === 0) {
				if (formattedError) {
					const currentCount = cline.consecutiveMistakeCountForApplyDiff.get(relPath) || 0
					if (currentCount >= 2) {
						await cline.say("diff_error", formattedError)
					}
					cline.recordToolError("apply_diff", formattedError)
					results.push(formattedError)
				}
				continue
			}

			cline.consecutiveMistakeCount = 0
			cline.consecutiveMistakeCountForApplyDiff.delete(relPath)

			// Show diff view before asking for approval
			cline.diffViewProvider.editType = "modify"
			await cline.diffViewProvider.open(relPath)
			await cline.diffViewProvider.update(originalContent, true)
			await cline.diffViewProvider.scrollToFirstDiff()

			// Set message for approval
			const diffContents = diffItems.map((item) => item.content).join("\n\n")
			const operationMessage = JSON.stringify({
				...sharedMessageProps,
				path: getReadablePath(cline.cwd, relPath),
				diff: diffContents,
			} satisfies ClineSayTool)

			let toolProgressStatus

			if (cline.diffStrategy && cline.diffStrategy.getProgressStatus) {
				toolProgressStatus = cline.diffStrategy.getProgressStatus(
					{
						...block,
						params: { ...block.params, diff: diffContents },
					},
					{ success: true }, // We've already applied each diff individually
				)
			}

			const didApprove = await askApproval("tool", operationMessage, toolProgressStatus)

			if (!didApprove) {
				await cline.diffViewProvider.revertChanges()
				results.push(`Changes to ${relPath} were not approved by user`)
				continue
			}

			const { newProblemsMessage, userEdits } = await cline.diffViewProvider.saveChanges()

			// Track file edit operation
			await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)

			// Used to determine if we should wait for busy terminal to update before sending api request
			cline.didEditFile = true
			let partFailHint = ""

			if (successCount < diffItems.length) {
				partFailHint = `Unable to apply all diff parts to file: ${absolutePath}`
			}

			if (userEdits) {
				await cline.say(
					"user_feedback_diff",
					JSON.stringify({
						tool: fileExists ? "editedExistingFile" : "newFileCreated",
						path: getReadablePath(cline.cwd, relPath),
						diff: userEdits,
					} satisfies ClineSayTool),
				)

				results.push(
					`Successfully applied changes to ${relPath} with user edits:
${userEdits}
${partFailHint ? partFailHint + "\n" : ""}${newProblemsMessage || ""}`,
				)
			} else {
				results.push(
					`Successfully applied ${successCount}/${diffItems.length} changes to ${relPath}${partFailHint ? "\n" + partFailHint : ""}${newProblemsMessage ? "\n" + newProblemsMessage : ""}`,
				)
			}

			await cline.diffViewProvider.reset()
		}

		// Push the final result combining all operation results
		pushToolResult(results.join("\n\n"))
		return
	} catch (error) {
		await handleError("applying diff", error)
		await cline.diffViewProvider.reset()
		return
	}
}
