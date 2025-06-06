import cloneDeep from "clone-deep"
import { serializeError } from "serialize-error"

import type { ToolName, ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse } from "../../shared/tools"

import { fetchInstructionsTool } from "../tools/fetchInstructionsTool"
import { listFilesTool } from "../tools/listFilesTool"
import { getReadFileToolDescription, readFileTool } from "../tools/readFileTool"
import { writeToFileTool } from "../tools/writeToFileTool"
import { applyDiffTool } from "../tools/applyDiffTool"
import { insertContentTool } from "../tools/insertContentTool"
import { searchAndReplaceTool } from "../tools/searchAndReplaceTool"
import { listCodeDefinitionNamesTool } from "../tools/listCodeDefinitionNamesTool"
import { searchFilesTool } from "../tools/searchFilesTool"
import { browserActionTool } from "../tools/browserActionTool"
import { executeCommandTool } from "../tools/executeCommandTool"
import { useMcpToolTool } from "../tools/useMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/askFollowupQuestionTool"
import { switchModeTool } from "../tools/switchModeTool"
import { attemptCompletionTool } from "../tools/attemptCompletionTool"
import { newTaskTool } from "../tools/newTaskTool"

import { checkpointSave } from "../checkpoints"

import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "../tools/validateToolUse"
import { Task } from "../task/Task"
import { codebaseSearchTool } from "../tools/codebaseSearchTool"
import { AudioProcessor } from "../../core/processors/AudioProcessor"; // Added for analyze_multimodal_data
import { CsvProcessor } from "../../core/processors/CsvProcessor"; // Added for analyze_multimodal_data
import fs from "fs/promises"; // Added for analyze_multimodal_data
import path from "path"; // Added for analyze_multimodal_data

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		throw new Error(`[Cline#presentAssistantMessage] task ${cline.taskId}.${cline.instanceId} aborted`)
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	const block = cloneDeep(cline.assistantMessageContent[cline.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too

	switch (block.type) {
		case "text": {
			if (cline.didRejectTool || cline.didAlreadyUseTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Remove end substrings of <thinking or </thinking (below xml
				// parsing is only for opening tags).
				// Tthis is done with the xml parsing below now, but keeping
				// here for reference.
				// content = content.replace(/<\/?t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?$/, "")
				//
				// Remove all instances of <thinking> (with optional line break
				// after) and </thinking> (with optional line break before).
				// - Needs to be separate since we dont want to remove the line
				//   break before the first tag.
				// - Needs to happen before the xml parsing below.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")

				// Remove partial XML tag at the very end of the content (for
				// tool use and thinking tags), Prevents scrollview from
				// jumping when tags are automatically removed.
				const lastOpenBracketIndex = content.lastIndexOf("<")

				if (lastOpenBracketIndex !== -1) {
					const possibleTag = content.slice(lastOpenBracketIndex)

					// Check if there's a '>' after the last '<' (i.e., if the
					// tag is complete) (complete thinking and tool tags will
					// have been removed by now.)
					const hasCloseBracket = possibleTag.includes(">")

					if (!hasCloseBracket) {
						// Extract the potential tag name.
						let tagContent: string

						if (possibleTag.startsWith("</")) {
							tagContent = possibleTag.slice(2).trim()
						} else {
							tagContent = possibleTag.slice(1).trim()
						}

						// Check if tagContent is likely an incomplete tag name
						// (letters and underscores only).
						const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)

						// Preemptively remove < or </ to keep from these
						// artifacts showing up in chat (also handles closing
						// thinking tags).
						const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"

						// If the tag is incomplete and at the end, remove it
						// from the content.
						if (isOpeningOrClosing || isLikelyTagName) {
							content = content.slice(0, lastOpenBracketIndex).trim()
						}
					}
				}
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use":
			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						return getReadFileToolDescription(block.name, block.params)
					case "fetch_instructions":
						return `[${block.name} for '${block.params.task}']`
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						return `[${block.name} for '${block.params.path}']`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "insert_content":
						return `[${block.name} for '${block.params.path}']`
					case "search_and_replace":
						return `[${block.name} for '${block.params.path}']`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "list_code_definition_names":
						return `[${block.name} for '${block.params.path}']`
					case "browser_action":
						return `[${block.name} for '${block.params.action}']`
					case "use_mcp_tool":
						return `[${block.name} for '${block.params.server_name}']`
					case "access_mcp_resource":
						return `[${block.name} for '${block.params.server_name}']`
					case "ask_followup_question":
						return `[${block.name} for '${block.params.question}']`
					case "attempt_completion":
						return `[${block.name}]`
					case "switch_mode":
						return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
					case "codebase_search": // Add case for the new tool
						return `[${block.name} for '${block.params.query}']`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
				}
			}

			if (cline.didRejectTool) {
				// Ignore any tool content after user has rejected tool once.
				if (!block.partial) {
					cline.userMessageContent.push({
						type: "text",
						text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
					})
				} else {
					// Partial tool after user rejected a previous tool.
					cline.userMessageContent.push({
						type: "text",
						text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
					})
				}

				break
			}

			if (cline.didAlreadyUseTool) {
				// Ignore any content after a tool has already been used.
				cline.userMessageContent.push({
					type: "text",
					text: `Tool [${block.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,
				})

				break
			}

			const pushToolResult = (content: ToolResponse) => {
				cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })

				if (typeof content === "string") {
					cline.userMessageContent.push({ type: "text", text: content || "(tool did not return anything)" })
				} else {
					cline.userMessageContent.push(...content)
				}

				// Once a tool result has been collected, ignore all other tool
				// uses since we should only ever present one tool result per
				// message.
				cline.didAlreadyUseTool = true
			}

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
			) => {
				const { response, text, images } = await cline.ask(type, partialMessage, false, progressStatus)

				if (response !== "yesButtonClicked") {
					// Handle both messageResponse and noButtonClicked with text.
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Handle yesButtonClicked with text.
				if (text) {
					await cline.say("user_feedback", text, images)
					pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
				}

				return true
			}

			const askFinishSubTaskApproval = async () => {
				// Ask the user to approve this task has completed, and he has
				// reviewed it, and we can declare task is finished and return
				// control to the parent task to continue running the rest of
				// the sub-tasks.
				const toolMessage = JSON.stringify({ tool: "finishTask" })
				return await askApproval("tool", toolMessage)
			}

			const handleError = async (action: string, error: Error) => {
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)

				pushToolResult(formatResponse.toolError(errorString))
			}

			// If block is partial, remove partial closing tag so its not
			// presented to user.
			const removeClosingTag = (tag: ToolParamName, text?: string): string => {
				if (!block.partial) {
					return text || ""
				}

				if (!text) {
					return ""
				}

				// This regex dynamically constructs a pattern to match the
				// closing tag:
				// - Optionally matches whitespace before the tag.
				// - Matches '<' or '</' optionally followed by any subset of
				//   characters from the tag name.
				const tagRegex = new RegExp(
					`\\s?<\/?${tag
						.split("")
						.map((char) => `(?:${char})?`)
						.join("")}$`,
					"g",
				)

				return text.replace(tagRegex, "")
			}

			if (block.name !== "browser_action") {
				await cline.browserSession.closeBrowser()
			}

			if (!block.partial) {
				cline.recordToolUsage(block.name)
				TelemetryService.instance.captureToolUsage(cline.taskId, block.name)
			}

			// Validate tool use before execution.
			const { mode, customModes } = (await cline.providerRef.deref()?.getState()) ?? {}

			try {
				validateToolUse(
					block.name as ToolName,
					mode ?? defaultModeSlug,
					customModes ?? [],
					{ apply_diff: cline.diffEnabled },
					block.params,
				)
			} catch (error) {
				cline.consecutiveMistakeCount++
				pushToolResult(formatResponse.toolError(error.message))
				break
			}

			// Check for identical consecutive tool calls.
			if (!block.partial) {
				// Use the detector to check for repetition, passing the ToolUse
				// block directly.
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				// If execution is not allowed, notify user and break.
				if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
					// Handle repetition similar to mistake_limit_reached pattern.
					const { response, text, images } = await cline.ask(
						repetitionCheck.askUser.messageKey as ClineAsk,
						repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
					)

					if (response === "messageResponse") {
						// Add user feedback to userContent.
						cline.userMessageContent.push(
							{
								type: "text" as const,
								text: `Tool repetition limit reached. User feedback: ${text}`,
							},
							...formatResponse.imageBlocks(images),
						)

						// Add user feedback to chat.
						await cline.say("user_feedback", text, images)

						// Track tool repetition in telemetry.
						TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
					}

					// Return tool result message about the repetition
					pushToolResult(
						formatResponse.toolError(
							`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
						),
					)
					break
				}
			}

			switch (block.name) {
				case "write_to_file":
					await writeToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "apply_diff":
					await applyDiffTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "insert_content":
					await insertContentTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "search_and_replace":
					await searchAndReplaceTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "read_file":
					await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)

					break
				case "fetch_instructions":
					await fetchInstructionsTool(cline, block, askApproval, handleError, pushToolResult)
					break
				case "list_files":
					await listFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "codebase_search":
					await codebaseSearchTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "list_code_definition_names":
					await listCodeDefinitionNamesTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "search_files":
					await searchFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "browser_action":
					await browserActionTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "execute_command":
					await executeCommandTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "use_mcp_tool":
					await useMcpToolTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "access_mcp_resource":
					await accessMcpResourceTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "ask_followup_question":
					await askFollowupQuestionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "switch_mode":
					await switchModeTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "new_task":
					await newTaskTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "attempt_completion":
					await attemptCompletionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
						toolDescription,
						askFinishSubTaskApproval,
					)
					break
				// --- synthesize_and_plan case START ---
				case "synthesize_and_plan": {
					const goal: string | undefined = block.params.goal;
					const toolName: ToolName = "synthesize_and_plan";

					try {
						if (block.partial) {
							await cline.ask(
								"tool",
								JSON.stringify({ tool: toolName, goal: removeClosingTag("goal", goal) }),
								block.partial,
							).catch(() => {});
							break;
						}

						if (!goal) {
							cline.consecutiveMistakeCount++;
							cline.recordToolError(toolName);
							pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "goal"));
							break;
						}
						cline.consecutiveMistakeCount = 0;

						const didApprove = await askApproval("tool", `Synthesizing a plan for goal: ${goal}`);
						if (!didApprove) {
							pushToolResult(formatResponse.toolDenied());
							break;
						}

						const conversationSummary = cline.clineMessages
							.map(m => `[${new Date(m.ts).toLocaleTimeString()}] ${m.type} ${m.say || m.ask}: ${m.text?.substring(0, 200)}`)
							.join('\n');

						const environmentDetails = await cline.getEnvironmentDetails(false, false);

						const metaPrompt = `You are a strategic AI planning assistant. Analyze the situation and formulate a plan.

GOAL: "${goal}"

CURRENT CONTEXT:
<conversation_history>
${conversationSummary}
</conversation_history>

<workspace_state>
${environmentDetails}
</workspace_state>

Based on all information, update the agent's mental model. Respond ONLY with a JSON object with keys "synthesis" (a brief summary of the current state) and "plan" (a string array of concrete next steps).`;

						await cline.say("api_req_started", JSON.stringify({ request: `Synthesizing plan for: "${goal}"` }), [], false, undefined, undefined, {isNonInteractive: true});

						let planJson = "";
						const stream = cline.api.createMessage(metaPrompt, [{role: "user", content: "Generate the plan."}]);
						for await (const chunk of stream) {
							if (chunk.type === "text") {
								planJson += chunk.text;
							} else if (chunk.type === "usage") {
								// Not explicitly handling usage for this internal LLM call in this tool
							}
						}
						planJson = planJson.trim();

						try {
							const parsedState = JSON.parse(planJson);
							if (parsedState.synthesis && Array.isArray(parsedState.plan)) {
								cline.agentState = {
									synthesis: parsedState.synthesis,
									plan: parsedState.plan,
								};
								await cline.say("completion_result", `New plan synthesized and adopted:\n- ${cline.agentState.plan.join("\n- ")}`, [], false, undefined, undefined, {isNonInteractive: true});
								pushToolResult(formatResponse.toolResult("Internal state and plan have been updated successfully."));
							} else {
								throw new Error("LLM response for plan did not contain correct JSON structure (synthesis and plan array).");
							}
						} catch (parseError: any) {
							cline.recordToolError(toolName, `Failed to parse LLM response as JSON: ${parseError.message}. Response: ${planJson}`);
							pushToolResult(formatResponse.toolError(`Failed to update mental model. LLM response was not valid JSON: ${planJson.substring(0, 200)}...`));
						}

						cline.recordToolUsage(toolName);
						break;
					} catch (error) {
						cline.recordToolError(toolName, error instanceof Error ? error.message : String(error));
						await handleError("synthesizing and planning", error instanceof Error ? error : new Error(String(error)));
						break;
					}
				}
				// --- synthesize_and_plan case END ---
				// --- analyze_multimodal_data case START ---
				case "analyze_multimodal_data": {
					const file_paths_param: string | undefined = block.params.file_paths;
					const toolName: ToolName = "analyze_multimodal_data";

					// `this` inside presentAssistantMessage refers to `cline` (the Task instance)
					// `askApproval`, `handleError`, `pushToolResult`, `removeClosingTag` are passed into `presentAssistantMessage`

					try {
						if (block.partial) {
							await cline.ask( // Use cline directly
								"tool",
								JSON.stringify({ tool: toolName, paths: removeClosingTag("file_paths", file_paths_param) }),
								block.partial,
							).catch(() => {});
							break;
						}

						if (!file_paths_param) {
							cline.consecutiveMistakeCount++;
							cline.recordToolError(toolName);
							pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "file_paths"));
							break;
						}
						cline.consecutiveMistakeCount = 0;

						const relPaths = file_paths_param.split('\n').map(p => p.trim()).filter(Boolean);
						if (relPaths.length === 0) {
							cline.recordToolError(toolName, "No file paths provided after splitting and filtering.");
							pushToolResult(formatResponse.toolError("No file paths provided."));
							break;
						}

						// Use the askApproval passed into presentAssistantMessage
						const didApprove = await askApproval("tool", `Analyzing data from: ${relPaths.join(', ')}`);
						if (!didApprove) {
							pushToolResult(formatResponse.toolDenied());
							break;
						}

						await cline.say("api_req_started", JSON.stringify({ request: `Analyzing ${relPaths.length} file(s)...`}), [], false, undefined, undefined, { isNonInteractive: true });

						let analysisResults = "";
						for (const relPath of relPaths) {
							const absolutePath = path.resolve(cline.cwd, relPath);
							const extension = path.extname(relPath).toLowerCase();
							let result = `\n--- Analysis for ${relPath} ---\n`;

							try {
								if (!cline.rooIgnoreController?.validateAccess(relPath)) {
									result += formatResponse.rooIgnoreError(relPath);
									analysisResults += result;
									continue;
								}
								await fs.access(absolutePath);

								switch (extension) {
									case '.wav':
									case '.mp3':
										result += await AudioProcessor.process(absolutePath);
										break;
									case '.csv':
										result += await CsvProcessor.process(absolutePath);
										break;
									case '.json':
										const jsonContent = await fs.readFile(absolutePath, 'utf-8');
										JSON.parse(jsonContent);
										result += `File is a valid JSON. Content length: ${jsonContent.length} characters. First 500 chars:\n${jsonContent.substring(0, 500)}`;
										break;
									case '.txt':
									default:
										const textContent = await fs.readFile(absolutePath, 'utf-8');
										result += `File treated as plain text. Content length: ${textContent.length} characters. First 500 chars:\n${textContent.substring(0, 500)}`;
										break;
								}
							} catch (e: any) {
								if (e.code === 'ENOENT') {
									 result += `Error processing file: File not found at ${relPath}`;
								} else {
									 result += `Error processing file ${relPath}: ${e.message}`;
								}
							}
							analysisResults += result + "\n";
						}

						await cline.say("completion_result", `Analysis complete for ${relPaths.length} file(s). Results included in tool output.`, [], false, undefined, undefined, { isNonInteractive: true });
						pushToolResult(formatResponse.toolResult(analysisResults.trim()));
						cline.recordToolUsage(toolName);
						break;
					} catch (error) {
						cline.recordToolError(toolName, error instanceof Error ? error.message : String(error));
						// Use handleError passed into presentAssistantMessage
						await handleError("analyzing multimodal data", error instanceof Error ? error : new Error(String(error)));
						break;
					}
				}
				// --- analyze_multimodal_data case END ---
			}

			break
	}

	const recentlyModifiedFiles = cline.fileContextTracker.getAndClearCheckpointPossibleFile()

	if (recentlyModifiedFiles.length > 0) {
		// TODO: We can track what file changes were made and only
		// checkpoint those files, this will be save storage.
		await checkpointSave(cline)
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the write_to_file tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			presentAssistantMessage(cline)
			return
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		presentAssistantMessage(cline)
	}
}
