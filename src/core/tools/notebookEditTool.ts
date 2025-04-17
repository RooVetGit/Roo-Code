import type { Cline } from "../Cline"
import type { ClineAsk } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import type { ToolParamName } from "../assistant-message"

type ToolUseBlock = {
	name: string
	params: Record<string, string>
	partial: boolean
}

// Define the simpler CellBlock type
type CellBlock = {
	header: string
	content: string
}

// Type for tagged cells (used for modify_cell_content)
type TaggedCellBlock = {
	index?: number // cell index for modify_cell_content (renamed from tag)
	cell: CellBlock
}

/**
 * Parse code blocks from a text string containing markdown
 * Returns an array of TaggedCellBlock objects
 */
function parseCodeBlocks(text: string): TaggedCellBlock[] {
	const taggedBlocks: TaggedCellBlock[] = []

	let pendingCellIndex: number | undefined = undefined
	let inCodeBlock = false
	let currentBlockHeader = ""
	let currentBlockContent = ""

	// Process line by line in a single pass
	for (const line of text.split("\n")) {
		if (inCodeBlock) {
			// Inside a code block
			if (line.trimEnd() === "```") {
				// End of code block
				inCodeBlock = false

				// Create the tagged cell block
				taggedBlocks.push({
					index: pendingCellIndex,
					cell: {
						header: currentBlockHeader,
						content: currentBlockContent.trim(),
					},
				})

				// Clear the pending cell index - it's been used
				pendingCellIndex = undefined
			} else {
				// Add content to the current code block
				currentBlockContent += line + "\n"
			}
		} else {
			// Outside a code block
			// Check for cell index tag
			const cellTagMatch = line.trimEnd().match(/@cell#(\d+)/)
			if (cellTagMatch) {
				pendingCellIndex = parseInt(cellTagMatch[1], 10)
				continue
			}

			// Check for the start of a code block
			const codeBlockStartMatch = line.trimEnd().match(/^```(.*)$/)
			if (codeBlockStartMatch) {
				inCodeBlock = true
				currentBlockHeader = codeBlockStartMatch[1].trim()
				currentBlockContent = ""
				continue
			}

			if (line.trim()) {
				// report unexpected line outside of code block
				throw new Error(`Unexpected line outside of code block: ${line}`)
			}
		}
	}

	return taggedBlocks
}

/**
 * Convert CellBlock to the format expected by NotebookService
 */
function convertCellBlockToDefinition(block: CellBlock) {
	const isMarkdown = block.header.toLowerCase() === "markdown"
	return {
		content: block.content,
		cell_type: isMarkdown ? "markdown" : "code",
		language_id: block.header,
	}
}

/**
 * Implementation of the notebook_edit tool
 */
export async function notebookEditTool(
	cline: Cline,
	block: ToolUseBlock,
	askApproval: (type: ClineAsk, partialMessage?: string) => Promise<boolean>,
	handleError: (action: string, error: Error) => Promise<void>,
	pushToolResult: (content: string) => void,
	removeClosingTag: (tag: ToolParamName, text?: string) => string,
) {
	// Create a typed variable to help with type checking
	const params = block.params
	const action: string | undefined = params.action
	const cellsContent: string | undefined = params.cells
	const insertAtIndex: string | undefined = params.insert_at_index
	const startIndex: string | undefined = params.start_index
	const endIndex: string | undefined = params.end_index
	const noexec: string | undefined = params.noexec

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "editNotebook",
						action: removeClosingTag("action", action),
						content: "",
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		if (!action) {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_edit", "action"))
			return
		}

		if (!cellsContent && action !== "delete_cells") {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_edit", "cells"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Validate inputs before asking for approval
		let validationError = ""
		let parsedData: any = null

		// Parse insertAtIndex if provided
		let parsedInsertAtIndex: number | undefined = undefined
		if (insertAtIndex !== undefined) {
			if (action !== "insert_cells") {
				validationError = "Parameter insert_at_index is only valid for insert_cells action"
			} else {
				try {
					parsedInsertAtIndex = parseInt(insertAtIndex.replace(/<\/?insert_at_index>/g, ""))
					if (isNaN(parsedInsertAtIndex) || parsedInsertAtIndex < 0) {
						validationError = `Invalid insert_at_index: ${insertAtIndex}. Must be a non-negative integer.`
					}
				} catch (e) {
					validationError = `Invalid insert_at_index: ${insertAtIndex}. Must be a non-negative integer.`
				}
			}
		}

		// Parse start_index and end_index for replace_cells and delete_cells
		let parsedStartIndex: number | undefined = undefined
		let parsedEndIndex: number | undefined = undefined

		if (action === "replace_cells" || action === "delete_cells") {
			if (startIndex === undefined) {
				validationError = `For ${action} action, start_index parameter is required`
			} else {
				try {
					parsedStartIndex = parseInt(startIndex.replace(/<\/?start_index>/g, ""))
					if (isNaN(parsedStartIndex) || parsedStartIndex < 0) {
						validationError = `Invalid start_index: ${startIndex}. Must be a non-negative integer.`
					}
				} catch (e) {
					validationError = `Invalid start_index: ${startIndex}. Must be a non-negative integer.`
				}
			}

			if (!validationError && endIndex === undefined) {
				validationError = `For ${action} action, end_index parameter is required`
			} else if (!validationError) {
				try {
					parsedEndIndex = parseInt(endIndex!.replace(/<\/?end_index>/g, ""))
					if (isNaN(parsedEndIndex) || parsedEndIndex <= parsedStartIndex!) {
						validationError = `Invalid end_index: ${endIndex}. Must be greater than start_index (${parsedStartIndex}).`
					}
				} catch (e) {
					validationError = `Invalid end_index: ${endIndex}. Must be a non-negative integer.`
				}
			}
		}

		// Process cell content based on the action
		if (!validationError && cellsContent) {
			const cleanedContent = cellsContent.replace(/<\/?cells>/g, "").trim()
			const taggedBlocks = parseCodeBlocks(cleanedContent)

			if (taggedBlocks.length === 0 && action !== "delete_cells") {
				validationError = `No code blocks found in cells content`
			} else {
				switch (action) {
					case "insert_cells": {
						// Convert cell blocks to cell definitions expected by NotebookService
						const cells = taggedBlocks.map((taggedBlock) => convertCellBlockToDefinition(taggedBlock.cell))

						parsedData = cells
						break
					}

					case "modify_cell_content": {
						// Validate that all blocks have tags
						const untaggedBlocks = taggedBlocks.filter((block) => block.index === undefined)
						if (untaggedBlocks.length > 0) {
							validationError = `Not all code blocks have @cell# tags. ${untaggedBlocks.length} blocks missing tags.`
							break
						}

						// Create array of cell modifications
						const cells = taggedBlocks.map((taggedBlock) => ({
							index: taggedBlock.index!,
							content: taggedBlock.cell.content,
						}))

						parsedData = cells
						break
					}

					case "replace_cells": {
						// Convert cell blocks to cell definitions expected by NotebookService
						const cells = taggedBlocks.map((taggedBlock) => convertCellBlockToDefinition(taggedBlock.cell))

						parsedData = {
							startIndex: parsedStartIndex,
							endIndex: parsedEndIndex,
							cells,
						}
						break
					}

					case "delete_cells": {
						parsedData = {
							startIndex: parsedStartIndex,
							endIndex: parsedEndIndex,
						}
						break
					}

					default:
						validationError = `Unknown action: ${action}. Valid actions for notebook_edit are: insert_cells, modify_cell_content, replace_cells, delete_cells.`
				}
			}
		} else if (action === "delete_cells") {
			parsedData = {
				startIndex: parsedStartIndex,
				endIndex: parsedEndIndex,
			}
		}

		if (validationError) {
			cline.consecutiveMistakeCount++
			await cline.say("error", validationError)
			pushToolResult(formatResponse.toolError(validationError))
			return
		}

		const approvalProps: any = {
			tool: "editNotebook",
			action: removeClosingTag("action", action),
		}

		// Ask for approval BEFORE executing the operation
		const didApprove = await askApproval("tool", JSON.stringify(approvalProps))
		if (!didApprove) {
			return
		}

		// Now actually execute the operation after approval
		try {
			const { NotebookService } = await import("../../services/notebook")
			let result = ""

			// Convert noexec string parameter to boolean
			// If it presents, means true unless explicitly spelled "false"
			const skipExecution = noexec !== undefined && noexec.toLowerCase() !== "false"

			// Get notebook settings from provider state
			const { notebookMaxOutputSize, notebookTimeoutSeconds } =
				(await cline.providerRef.deref()?.getState()) ?? {}
			const maxOutputSize = notebookMaxOutputSize ?? 2000
			const timeoutSeconds = notebookTimeoutSeconds ?? 30

			switch (action) {
				case "insert_cells": {
					// Cells are already in the format expected by NotebookService
					result = await NotebookService.insertCells(
						parsedData,
						parsedInsertAtIndex,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
				case "modify_cell_content": {
					// Handle multiple cell modifications by iterating through them
					const results = []
					const cells = parsedData

					for (const cell of cells) {
						const cellIndex = cell.index
						const cellContent = cell.content

						// Create validation callback for this specific cell
						const validateCellIndex = (cellCount: number) => {
							if (cellIndex < 0 || cellIndex >= cellCount) {
								throw new Error(`Invalid index: ${cellIndex}. Valid range is 0-${cellCount - 1}.`)
							}
							return cellIndex
						}

						// Modify the cell
						const result = await NotebookService.modifyCellContent(
							validateCellIndex,
							cellContent,
							skipExecution,
							maxOutputSize,
							timeoutSeconds,
						)

						results.push(result)
					}

					result = results.join("\n")
					break
				}
				case "replace_cells": {
					// Create validation callback that validates indices and cells
					const validateIndicesAndCells = (cellCount: number) => {
						const startIdx = parsedData.startIndex
						const endIdx = parsedData.endIndex

						if (startIdx < 0 || startIdx >= cellCount) {
							throw new Error(`Invalid start_index: ${startIdx}. Valid range is 0-${cellCount - 1}.`)
						}

						if (endIdx <= startIdx || endIdx > cellCount) {
							throw new Error(`Invalid end_index: ${endIdx}. Must be > ${startIdx} and <= ${cellCount}.`)
						}

						return {
							startIndex: startIdx,
							endIndex: endIdx,
							cells: parsedData.cells,
						}
					}

					result = await NotebookService.replaceCells(
						validateIndicesAndCells,
						skipExecution,
						maxOutputSize,
						timeoutSeconds,
					)
					break
				}
				case "delete_cells": {
					// Create validation callback that validates indices
					const validateIndices = (cellCount: number) => {
						const startIdx = parsedData.startIndex
						const endIdx = parsedData.endIndex

						if (startIdx < 0 || startIdx >= cellCount) {
							throw new Error(`Invalid start_index: ${startIdx}. Valid range is 0-${cellCount - 1}.`)
						}

						if (endIdx <= startIdx || endIdx > cellCount) {
							throw new Error(`Invalid end_index: ${endIdx}. Must be > ${startIdx} and <= ${cellCount}.`)
						}

						return {
							startIndex: startIdx,
							endIndex: endIdx,
						}
					}

					result = await NotebookService.deleteCells(validateIndices)
					break
				}
			}

			pushToolResult(result)
		} catch (error) {
			const errorMsg = `Error executing notebook_edit tool: ${error instanceof Error ? error.message : String(error)}`
			await cline.say("error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
		}
	} catch (error) {
		await handleError("executing notebook_edit tool", error)
	}
}
