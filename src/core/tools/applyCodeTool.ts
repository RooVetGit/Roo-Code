import path from "path"
import fs from "fs/promises"

import { TelemetryService } from "@roo-code/telemetry"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"

import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, RemoveClosingTag, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { fileExistsAtPath } from "../../utils/fs"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { buildApiHandler } from "../../api"

interface CodeGenerationResult {
	file: string
	type: "snippet" | "full_file"
	code: string
}

export async function applyCodeTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const instruction: string | undefined = block.params.instruction

	const sharedMessageProps: ClineSayTool = {
		tool: "applyCode",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		instruction: removeClosingTag("instruction", instruction),
	}

	try {
		if (block.partial) {
			// Update GUI message
			await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		} else {
			if (!relPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("apply_code")
				pushToolResult(await cline.sayAndCreateMissingParamError("apply_code", "path"))
				return
			}

			if (!instruction) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("apply_code")
				pushToolResult(await cline.sayAndCreateMissingParamError("apply_code", "instruction"))
				return
			}

			const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)

			if (!accessAllowed) {
				await cline.say("rooignore_error", relPath)
				pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
				return
			}

			const absolutePath = path.resolve(cline.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath)

			// Read the original file content if it exists
			let originalContent = ""
			if (fileExists) {
				originalContent = await fs.readFile(absolutePath, "utf-8")
			}

			// Stage 1: Creative Code Generation
			const codeGenPrompt = `You are a code generation expert. Generate code based on the following instruction.

File: ${relPath}
${fileExists ? `Current content:\n\`\`\`\n${originalContent}\n\`\`\`` : "File does not exist yet."}

Instruction: ${instruction}

Respond with a JSON object in this exact format:
{
  "file": "${relPath}",
  "type": "${fileExists ? "snippet" : "full_file"}",
  "code": "your generated code here"
}

IMPORTANT: 
- For existing files, generate only the new/modified code snippet
- For new files, generate the complete file content
- Do not include any markdown code blocks in the "code" field
- Ensure proper escaping of quotes and newlines in JSON`

			// Make first API call for code generation
			const codeGenMessages = [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: codeGenPrompt }],
				},
			]

			const codeGenStream = cline.api.createMessage(
				"You are a code generation expert. Generate code exactly as requested.",
				codeGenMessages,
				{ taskId: cline.taskId, mode: "code_generation" },
			)

			let codeGenResponse = ""
			for await (const chunk of codeGenStream) {
				if (chunk.type === "text") {
					codeGenResponse += chunk.text
				}
			}

			// Parse the code generation result
			let codeGenResult: CodeGenerationResult
			try {
				codeGenResult = JSON.parse(codeGenResponse)
			} catch (error) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("apply_code")
				const formattedError = `Failed to parse code generation response: ${error.message}\n\nResponse: ${codeGenResponse}`
				await cline.say("error", formattedError)
				pushToolResult(formattedError)
				return
			}

			// Stage 2: Focused Diff Generation
			let diffContent = ""
			if (fileExists && codeGenResult.type === "snippet") {
				const diffGenPrompt = `You are a diff generation expert. Given the original file content and new code, generate a standard unified diff patch to integrate the new code into the original file.

Original file content:
\`\`\`
${originalContent}
\`\`\`

New code to integrate:
\`\`\`
${codeGenResult.code}
\`\`\`

Generate a diff in the exact format used by the apply_diff tool:
<<<<<<< SEARCH
[exact content to find including whitespace]
=======
[new content to replace with]
>>>>>>> REPLACE

IMPORTANT:
- The SEARCH section must exactly match existing content
- Include proper indentation and whitespace
- You may use multiple SEARCH/REPLACE blocks if needed
- Focus only on integrating the new code logically`

				const diffGenMessages = [
					{
						role: "user" as const,
						content: [{ type: "text" as const, text: diffGenPrompt }],
					},
				]

				const diffGenStream = cline.api.createMessage(
					"You are a diff generation expert. Generate accurate diffs for code integration.",
					diffGenMessages,
					{ taskId: cline.taskId, mode: "diff_generation" },
				)

				for await (const chunk of diffGenStream) {
					if (chunk.type === "text") {
						diffContent += chunk.text
					}
				}

				// Apply the diff using the existing diff strategy
				const diffResult = (await cline.diffStrategy?.applyDiff(originalContent, diffContent)) ?? {
					success: false,
					error: "No diff strategy available",
				}

				if (!diffResult.success) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("apply_code")
					const formattedError = `Failed to apply generated diff: ${diffResult.error}`
					await cline.say("error", formattedError)
					pushToolResult(formattedError)
					return
				}

				// Show diff view before asking for approval
				cline.diffViewProvider.editType = "modify"
				await cline.diffViewProvider.open(relPath)
				await cline.diffViewProvider.update(diffResult.content, true)
				cline.diffViewProvider.scrollToFirstDiff()

				// Check if file is write-protected
				const isWriteProtected = cline.rooProtectedController?.isWriteProtected(relPath) || false

				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					diff: formatResponse.createPrettyPatch(relPath, originalContent, diffResult.content),
					isProtected: isWriteProtected,
				} satisfies ClineSayTool)

				const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

				if (!didApprove) {
					await cline.diffViewProvider.revertChanges()
					return
				}

				// Save the changes
				const provider = cline.providerRef.deref()
				const state = await provider?.getState()
				const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
				const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
				await cline.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
			} else {
				// For new files or full file replacements, use the generated code directly
				cline.diffViewProvider.editType = fileExists ? "modify" : "create"
				await cline.diffViewProvider.open(relPath)
				await cline.diffViewProvider.update(codeGenResult.code, true)
				cline.diffViewProvider.scrollToFirstDiff()

				// Check if file is write-protected
				const isWriteProtected = cline.rooProtectedController?.isWriteProtected(relPath) || false

				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: fileExists ? undefined : codeGenResult.code,
					diff: fileExists
						? formatResponse.createPrettyPatch(relPath, originalContent, codeGenResult.code)
						: undefined,
					isProtected: isWriteProtected,
				} satisfies ClineSayTool)

				const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

				if (!didApprove) {
					await cline.diffViewProvider.revertChanges()
					return
				}

				// Save the changes
				const provider = cline.providerRef.deref()
				const state = await provider?.getState()
				const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
				const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
				await cline.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			// Track file edit operation
			if (relPath) {
				await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			// Used to determine if we should wait for busy terminal to update before sending api request
			cline.didEditFile = true

			// Get the formatted response message
			const message = await cline.diffViewProvider.pushToolWriteResult(cline, cline.cwd, !fileExists)

			pushToolResult(message)

			await cline.diffViewProvider.reset()

			cline.consecutiveMistakeCount = 0
			cline.recordToolUsage("apply_code")

			return
		}
	} catch (error) {
		await handleError("applying code", error)
		await cline.diffViewProvider.reset()
		return
	}
}
