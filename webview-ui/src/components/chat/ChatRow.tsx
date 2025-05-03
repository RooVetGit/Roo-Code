import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import { useTranslation, Trans } from "react-i18next"
import deepEqual from "fast-deep-equal"
import { VSCodeBadge, VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { ClineApiReqInfo, ClineAskUseMcpServer, ClineMessage, ClineSayTool } from "@roo/shared/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "@roo/shared/combineCommandSequences"
import { safeJsonParse } from "@roo/shared/safeJsonParse"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import { vscode } from "@src/utils/vscode"
import { Button } from "@src/components/ui"

import CodeAccordian, { removeLeadingNonAlphanumeric } from "../common/CodeAccordian"
import CodeBlock, { CODE_BLOCK_BG_COLOR } from "../common/CodeBlock"
import MarkdownBlock from "../common/MarkdownBlock"
import { ReasoningBlock } from "./ReasoningBlock"
import Thumbnails from "../common/Thumbnails"
import McpResourceRow from "../mcp/McpResourceRow"
import McpToolRow from "../mcp/McpToolRow"

import { Mention } from "./Mention"
import { CheckpointSaved } from "./checkpoints/CheckpointSaved"
import { FollowUpSuggest } from "./FollowUpSuggest"
import { ProgressIndicator } from "./ProgressIndicator"
import { Markdown } from "./Markdown"
import { CommandExecution } from "./CommandExecution"
import { CommandExecutionError } from "./CommandExecutionError"

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: () => void
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	searchText?: string
	// Update highlightText signature to include itemIndex
	highlightText?: (text: string, searchTerm: string, itemIndex: number) => React.ReactNode
	itemIndex: number // Add itemIndex prop
}

// Update ChatRowContentProps to include itemIndex
interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange" | "message"> {
	message: ClineMessage // Ensure message is explicitly included
	itemIndex: number
}

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0)

		const [chatrow, { height }] = useSize(
			<div className="px-[15px] py-[10px] pr-[6px]">
				<ChatRowContent {...props} />
			</div>,
		)

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0 // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					const isTaller = height > prevHeightRef.current
					console.log(
						`[ChatRow ${message.ts}] Height changed: ${prevHeightRef.current} -> ${height}. isTaller: ${isTaller}. Calling onHeightChange.`,
					)
					// Pass row timestamp for context in ChatView logs
					onHeightChange(isTaller) // Pass only isTaller
				} else {
					// console.log(`[ChatRow ${message.ts}] Initial render height: ${height}`); // Can be noisy
				}
				prevHeightRef.current = height
			}
		}, [height, isLast, onHeightChange, message])

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
)

export default ChatRow

export const ChatRowContent = ({
	message,
	lastModifiedMessage,
	isExpanded,
	isLast,
	isStreaming,
	onToggleExpand,
	onSuggestionClick,
	// Destructure search props and itemIndex
	searchText,
	highlightText,
	itemIndex, // Destructure itemIndex
}: ChatRowContentProps) => {
	const { t } = useTranslation()
	const { mcpServers, alwaysAllowMcp, currentCheckpoint } = useExtensionState()
	const [reasoningCollapsed, setReasoningCollapsed] = useState(true)
	const [isDiffErrorExpanded, setIsDiffErrorExpanded] = useState(false)
	const [showCopySuccess, setShowCopySuccess] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text !== null && message.text !== undefined && message.say === "api_req_started") {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
		}

		return [undefined, undefined, undefined]
	}, [message.text, message.say])

	// When resuming task, last wont be api_req_failed but a resume_task
	// message, so api_req_started will show loading spinner. That's why we just
	// remove the last api_req_started that failed without streaming anything.
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" // if request is retried then the latest message is a api_req_retried
			? lastModifiedMessage?.text
			: undefined

	const isCommandExecuting =
		isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)

	const isMcpServerResponding = isLast && lastModifiedMessage?.say === "mcp_server_request_started"

	const type = message.type === "ask" ? message.ask : message.say

	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	const [icon, title] = useMemo(() => {
		switch (type) {
			case "error":
				return [
					<span
						className="codicon codicon-error"
						style={{ color: errorColor, marginBottom: "-1.5px" }}></span>,
					<span style={{ color: errorColor, fontWeight: "bold" }}>
						{searchText && highlightText
							? highlightText(t("chat:error"), searchText, itemIndex)
							: t("chat:error")}
					</span>,
				]
			case "mistake_limit_reached":
				return [
					<span
						className="codicon codicon-error"
						style={{ color: errorColor, marginBottom: "-1.5px" }}></span>,
					<span style={{ color: errorColor, fontWeight: "bold" }}>
						{searchText && highlightText
							? highlightText(t("chat:troubleMessage"), searchText, itemIndex)
							: t("chat:troubleMessage")}
					</span>,
				]
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-terminal"
							style={{ color: normalColor, marginBottom: "-1.5px" }}></span>
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{searchText && highlightText
							? highlightText(t("chat:runCommand.title") + ":", searchText, itemIndex)
							: t("chat:runCommand.title") + ":"}
					</span>,
				]
			case "use_mcp_server":
				const mcpServerUse = safeJsonParse<ClineAskUseMcpServer>(message.text)
				if (mcpServerUse === undefined) {
					return [null, null]
				}
				const mcpTitle =
					mcpServerUse.type === "use_mcp_tool"
						? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName })
						: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName })
				return [
					isMcpServerResponding ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-server"
							style={{ color: normalColor, marginBottom: "-1.5px" }}></span>
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{searchText && highlightText ? highlightText(mcpTitle, searchText, itemIndex) : mcpTitle}
					</span>,
				]
			case "completion_result":
				return [
					<span
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: "-1.5px" }}></span>,
					<span style={{ color: successColor, fontWeight: "bold" }}>
						{searchText && highlightText
							? highlightText(t("chat:taskCompleted"), searchText, itemIndex)
							: t("chat:taskCompleted")}
					</span>,
				]
			case "api_req_retry_delayed":
				return []
			case "api_req_started":
				const getIconSpan = (iconName: string, color: string) => (
					<div
						style={{
							width: 16,
							height: 16,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<span
							className={`codicon codicon-${iconName}`}
							style={{ color, fontSize: 16, marginBottom: "-1.5px" }}
						/>
					</div>
				)
				let apiReqTitle: string
				let apiReqColor: string
				if (apiReqCancelReason !== null && apiReqCancelReason !== undefined) {
					if (apiReqCancelReason === "user_cancelled") {
						apiReqTitle = t("chat:apiRequest.cancelled")
						apiReqColor = normalColor
					} else {
						apiReqTitle = t("chat:apiRequest.streamingFailed")
						apiReqColor = errorColor
					}
				} else if (cost !== null && cost !== undefined) {
					apiReqTitle = t("chat:apiRequest.title")
					apiReqColor = normalColor
				} else if (apiRequestFailedMessage) {
					apiReqTitle = t("chat:apiRequest.failed")
					apiReqColor = errorColor
				} else {
					apiReqTitle = t("chat:apiRequest.streaming")
					apiReqColor = normalColor
				}
				return [
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							getIconSpan("error", cancelledColor)
						) : (
							getIconSpan("error", errorColor)
						)
					) : cost !== null && cost !== undefined ? (
						getIconSpan("check", successColor)
					) : apiRequestFailedMessage ? (
						getIconSpan("error", errorColor)
					) : (
						<ProgressIndicator />
					),
					<span style={{ color: apiReqColor, fontWeight: "bold" }}>
						{searchText && highlightText ? highlightText(apiReqTitle, searchText, itemIndex) : apiReqTitle}
					</span>,
				]
			case "followup":
				return [
					<span
						className="codicon codicon-question"
						style={{ color: normalColor, marginBottom: "-1.5px" }}
					/>,
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{searchText && highlightText
							? highlightText(t("chat:questions.hasQuestion"), searchText, itemIndex)
							: t("chat:questions.hasQuestion")}
					</span>,
				]
			default:
				return [null, null]
		}
	}, [
		type,
		isCommandExecuting,
		message,
		isMcpServerResponding,
		apiReqCancelReason,
		cost,
		apiRequestFailedMessage,
		t,
		searchText, // Added
		highlightText, // Added
		itemIndex,
	])

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "10px",
		wordBreak: "break-word",
	}

	const pStyle: React.CSSProperties = {
		margin: 0,
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
		overflowWrap: "anywhere",
	}

	const tool = useMemo(
		() => (message.ask === "tool" ? safeJsonParse<ClineSayTool>(message.text) : null),
		[message.ask, message.text],
	)

	const followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<any>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	if (tool) {
		const toolIcon = (name: string) => (
			<span
				className={`codicon codicon-${name}`}
				style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}></span>
		)

		switch (tool.tool) {
			case "editedExistingFile":
			case "appliedDiff":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon(tool.tool === "appliedDiff" ? "diff" : "edit")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(
											tool.isOutsideWorkspace
												? t("chat:fileOperations.wantsToEditOutsideWorkspace")
												: t("chat:fileOperations.wantsToEdit"),
											searchText,
											itemIndex, // Pass itemIndex
										)
									: tool.isOutsideWorkspace
										? t("chat:fileOperations.wantsToEditOutsideWorkspace")
										: t("chat:fileOperations.wantsToEdit")}
							</span>
						</div>
						<CodeAccordian
							progressStatus={message.progressStatus}
							isLoading={message.partial}
							diff={tool.diff!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "insertContent":
				const insertTitle = tool.isOutsideWorkspace
					? t("chat:fileOperations.wantsToEditOutsideWorkspace")
					: tool.lineNumber === 0
						? t("chat:fileOperations.wantsToInsertAtEnd")
						: t("chat:fileOperations.wantsToInsertWithLineNumber", {
								lineNumber: tool.lineNumber,
							})
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("insert")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(insertTitle, searchText, itemIndex)
									: insertTitle}
							</span>
						</div>
						<CodeAccordian
							progressStatus={message.progressStatus}
							isLoading={message.partial}
							diff={tool.diff!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "searchAndReplace":
				const searchReplaceTitle =
					message.type === "ask"
						? t("chat:fileOperations.wantsToSearchReplace")
						: t("chat:fileOperations.didSearchReplace")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("replace")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(searchReplaceTitle, searchText, itemIndex)
									: searchReplaceTitle}
							</span>
						</div>
						<CodeAccordian
							progressStatus={message.progressStatus}
							isLoading={message.partial}
							diff={tool.diff!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "newFileCreated":
				const newFileTitle = t("chat:fileOperations.wantsToCreate")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("new-file")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(newFileTitle, searchText, itemIndex)
									: newFileTitle}
							</span>
						</div>
						<CodeAccordian
							isLoading={message.partial}
							code={tool.content!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "readFile":
				const readFileTitle =
					message.type === "ask"
						? tool.isOutsideWorkspace
							? t("chat:fileOperations.wantsToReadOutsideWorkspace")
							: t("chat:fileOperations.wantsToRead")
						: t("chat:fileOperations.didRead")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("file-code")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(readFileTitle, searchText, itemIndex)
									: readFileTitle}
							</span>
						</div>
						<div
							style={{
								borderRadius: 3,
								backgroundColor: CODE_BLOCK_BG_COLOR,
								overflow: "hidden",
								border: "1px solid var(--vscode-editorGroup-border)",
							}}>
							<div
								style={{
									color: "var(--vscode-descriptionForeground)",
									display: "flex",
									alignItems: "center",
									padding: "9px 10px",
									cursor: "pointer",
									userSelect: "none",
									WebkitUserSelect: "none",
									MozUserSelect: "none",
									msUserSelect: "none",
								}}
								onClick={() => {
									vscode.postMessage({ type: "openFile", text: tool.content })
								}}>
								{tool.path?.startsWith(".") && <span>.</span>}
								<span
									style={{
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										marginRight: "8px",
										direction: "rtl",
										textAlign: "left",
									}}>
									{searchText && highlightText
										? highlightText(
												removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E",
												searchText,
												itemIndex,
											)
										: removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"}
									{tool.reason && searchText && highlightText
										? highlightText(tool.reason, searchText, itemIndex)
										: tool.reason}
								</span>
								<div style={{ flexGrow: 1 }}></div>
								<span
									className={`codicon codicon-link-external`}
									style={{ fontSize: 13.5, margin: "1px 0" }}></span>
							</div>
						</div>
					</>
				)
			case "fetchInstructions":
				const fetchTitle = t("chat:instructions.wantsToFetch")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("file-code")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(fetchTitle, searchText, itemIndex)
									: fetchTitle}
							</span>
						</div>
						<CodeAccordian
							isLoading={message.partial}
							code={tool.content!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "listFilesTopLevel":
				const listTopLevelTitle =
					message.type === "ask"
						? t("chat:directoryOperations.wantsToViewTopLevel")
						: t("chat:directoryOperations.didViewTopLevel")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("folder-opened")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(listTopLevelTitle, searchText, itemIndex)
									: listTopLevelTitle}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							language="shell-session"
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "listFilesRecursive":
				const listRecursiveTitle =
					message.type === "ask"
						? t("chat:directoryOperations.wantsToViewRecursive")
						: t("chat:directoryOperations.didViewRecursive")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("folder-opened")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(listRecursiveTitle, searchText, itemIndex)
									: listRecursiveTitle}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							language="shell-session"
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "listCodeDefinitionNames":
				const listDefsTitle =
					message.type === "ask"
						? t("chat:directoryOperations.wantsToViewDefinitions")
						: t("chat:directoryOperations.didViewDefinitions")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("file-code")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(listDefsTitle, searchText, itemIndex)
									: listDefsTitle}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "searchFiles":
				const wantsSearchText = t("chat:directoryOperations.wantsToSearch", { regex: tool.regex })
				const didSearchText = t("chat:directoryOperations.didSearch", { regex: tool.regex })
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("search")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask" ? (
									searchText && highlightText ? (
										highlightText(wantsSearchText.replace(tool.regex!, ""), searchText, itemIndex) // Pass itemIndex
									) : (
										<Trans
											i18nKey="chat:directoryOperations.wantsToSearch"
											components={{ code: <code>{tool.regex}</code> }}
											values={{ regex: tool.regex }}
										/>
									)
								) : searchText && highlightText ? (
									highlightText(didSearchText.replace(tool.regex!, ""), searchText, itemIndex) // Pass itemIndex
								) : (
									<Trans
										i18nKey="chat:directoryOperations.didSearch"
										components={{ code: <code>{tool.regex}</code> }}
										values={{ regex: tool.regex }}
									/>
								)}
								{/* Render the regex separately if highlighting, as Trans might interfere */}
								{searchText && highlightText && <code>{tool.regex}</code>}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path! + (tool.filePattern ? `/(${tool.filePattern})` : "")}
							language="log"
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
							searchText={searchText}
							// Pass highlightText and itemIndex if CodeAccordian needs them
							// highlightText={highlightText}
							// itemIndex={itemIndex}
						/>
					</>
				)
			case "switchMode":
				const wantsSwitchReasonText = t("chat:modes.wantsToSwitchWithReason", {
					mode: tool.mode,
					reason: tool.reason,
				})
				const wantsSwitchText = t("chat:modes.wantsToSwitch", { mode: tool.mode })
				const didSwitchReasonText = t("chat:modes.didSwitchWithReason", {
					mode: tool.mode,
					reason: tool.reason,
				})
				const didSwitchText = t("chat:modes.didSwitch", { mode: tool.mode })

				const renderSwitchText = (baseText: string, mode: string, reason?: string) => {
					if (!searchText || !highlightText) {
						return (
							<Trans
								i18nKey={
									message.type === "ask"
										? reason
											? "chat:modes.wantsToSwitchWithReason"
											: "chat:modes.wantsToSwitch"
										: reason
											? "chat:modes.didSwitchWithReason"
											: "chat:modes.didSwitch"
								}
								components={{ code: <code>{mode}</code> }}
								values={{ mode, reason }}
							/>
						)
					}
					// Highlight text around the code block
					const parts = baseText.split(mode)
					const reasonPart = reason ? baseText.split(reason)[1] || "" : "" // Get text after reason if exists
					return (
						<>
							{highlightText(parts[0] ?? "", searchText, itemIndex)} {/* Pass itemIndex */}
							<code>{mode}</code>
							{reason ? (
								<>
									{highlightText(parts[1]?.split(reason)[0] ?? "", searchText, itemIndex)}{" "}
									{/* Pass itemIndex */}
									{highlightText(reason, searchText, itemIndex)} {/* Pass itemIndex */}
									{highlightText(reasonPart, searchText, itemIndex)} {/* Pass itemIndex */}
								</>
							) : (
								highlightText(parts[1] ?? "", searchText, itemIndex) // Pass itemIndex
							)}
						</>
					)
				}

				return (
					<>
						<div style={headerStyle}>
							{toolIcon("symbol-enum")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask"
									? tool.reason
										? renderSwitchText(wantsSwitchReasonText, tool.mode!, tool.reason)
										: renderSwitchText(wantsSwitchText, tool.mode!)
									: tool.reason
										? renderSwitchText(didSwitchReasonText, tool.mode!, tool.reason)
										: renderSwitchText(didSwitchText, tool.mode!)}
							</span>
						</div>
					</>
				)
			case "newTask":
				const wantsCreateText = t("chat:subtasks.wantsToCreate", { mode: tool.mode })
				const newTaskContentTitle = t("chat:subtasks.newTaskContent")

				const renderNewTaskText = (baseText: string, mode: string) => {
					if (!searchText || !highlightText) {
						return (
							<Trans
								i18nKey="chat:subtasks.wantsToCreate"
								components={{ code: <code>{mode}</code> }}
								values={{ mode }}
							/>
						)
					}
					const parts = baseText.split(mode)
					return (
						<>
							{highlightText(parts[0] || "", searchText, itemIndex)} {/* Pass itemIndex */}
							<code>{mode}</code>
							{highlightText(parts[1] || "", searchText, itemIndex)} {/* Pass itemIndex */}
						</>
					)
				}

				return (
					<>
						<div style={headerStyle}>
							{toolIcon("tasklist")}
							<span style={{ fontWeight: "bold" }}>{renderNewTaskText(wantsCreateText, tool.mode!)}</span>
						</div>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-badge-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px 4px 0 0",
								overflow: "hidden",
								marginBottom: "2px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-arrow-right"></span>
								{searchText && highlightText
									? highlightText(newTaskContentTitle, searchText, itemIndex) // Pass itemIndex
									: newTaskContentTitle}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								{/* Remove highlight props from MarkdownBlock */}
								<MarkdownBlock markdown={tool.content} searchText={searchText} />
							</div>
						</div>
					</>
				)
			case "finishTask":
				const finishTitle = t("chat:subtasks.wantsToFinish")
				const completionContentTitle = t("chat:subtasks.completionContent")
				const completionInstructions = t("chat:subtasks.completionInstructions")
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("check-all")}
							<span style={{ fontWeight: "bold" }}>
								{searchText && highlightText
									? highlightText(finishTitle, searchText, itemIndex)
									: finishTitle}
							</span>
						</div>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-editor-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px",
								overflow: "hidden",
								marginBottom: "8px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-check"></span>
								{searchText && highlightText
									? highlightText(completionContentTitle, searchText, itemIndex) // Pass itemIndex
									: completionContentTitle}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								{/* Remove highlight props from MarkdownBlock */}
								<MarkdownBlock markdown={completionInstructions} searchText={searchText} />
							</div>
						</div>
					</>
				)
			default:
				return null
		}
	}

	switch (message.type) {
		case "say":
			switch (message.say) {
				case "diff_error":
					return (
						<div>
							<div
								style={{
									marginTop: "0px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div
									style={{
										borderBottom: isDiffErrorExpanded
											? "1px solid var(--vscode-editorGroup-border)"
											: "none",
										fontWeight: "normal",
										fontSize: "var(--vscode-font-size)",
										color: "var(--vscode-editor-foreground)",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										cursor: "pointer",
									}}
									onClick={() => setIsDiffErrorExpanded(!isDiffErrorExpanded)}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "10px",
											flexGrow: 1,
										}}>
										<span
											className="codicon codicon-warning"
											style={{
												color: "var(--vscode-editorWarning-foreground)",
												opacity: 0.8,
												fontSize: 16,
												marginBottom: "-1.5px",
											}}></span>
										<span style={{ fontWeight: "bold" }}>{t("chat:diffError.title")}</span>
									</div>
									<div style={{ display: "flex", alignItems: "center" }}>
										<VSCodeButton
											appearance="icon"
											style={{
												padding: "3px",
												height: "24px",
												marginRight: "4px",
												color: "var(--vscode-editor-foreground)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												background: "transparent",
											}}
											onClick={(e) => {
												e.stopPropagation()

												// Call copyWithFeedback and handle the Promise
												copyWithFeedback(message.text || "").then((success) => {
													if (success) {
														// Show checkmark
														setShowCopySuccess(true)

														// Reset after a brief delay
														setTimeout(() => {
															setShowCopySuccess(false)
														}, 1000)
													}
												})
											}}>
											<span
												className={`codicon codicon-${showCopySuccess ? "check" : "copy"}`}></span>
										</VSCodeButton>
										<span
											className={`codicon codicon-chevron-${isDiffErrorExpanded ? "up" : "down"}`}></span>
									</div>
								</div>
								{isDiffErrorExpanded && (
									<div
										style={{
											padding: "8px",
											backgroundColor: "var(--vscode-editor-background)",
											borderTop: "none",
										}}>
										<CodeBlock source={`${"```"}plaintext\n${message.text || ""}\n${"```"}`} />
									</div>
								)}
							</div>
						</div>
					)
				case "subtask_result":
					return (
						<div>
							<div
								style={{
									marginTop: "0px",
									backgroundColor: "var(--vscode-badge-background)",
									border: "1px solid var(--vscode-badge-background)",
									borderRadius: "0 0 4px 4px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div
									style={{
										padding: "9px 10px 9px 14px",
										backgroundColor: "var(--vscode-badge-background)",
										borderBottom: "1px solid var(--vscode-editorGroup-border)",
										fontWeight: "bold",
										fontSize: "var(--vscode-font-size)",
										color: "var(--vscode-badge-foreground)",
										display: "flex",
										alignItems: "center",
										gap: "6px",
									}}>
									<span className="codicon codicon-arrow-left"></span>
									{t("chat:subtasks.resultContent")}
								</div>
								<div
									style={{
										padding: "12px 16px",
										backgroundColor: "var(--vscode-editor-background)",
									}}>
									<MarkdownBlock markdown={message.text} />
								</div>
							</div>
						</div>
					)
				case "reasoning":
					return (
						<ReasoningBlock
							content={message.text || ""}
							elapsed={isLast && isStreaming ? Date.now() - message.ts : undefined}
							isCollapsed={reasoningCollapsed}
							onToggleCollapse={() => setReasoningCollapsed(!reasoningCollapsed)}
						/>
					)
				case "api_req_started":
					return (
						<>
							<div
								style={{
									...headerStyle,
									marginBottom:
										((cost === null || cost === undefined) && apiRequestFailedMessage) ||
										apiReqStreamingFailedMessage
											? 10
											: 0,
									justifyContent: "space-between",
									cursor: "pointer",
									userSelect: "none",
									WebkitUserSelect: "none",
									MozUserSelect: "none",
									msUserSelect: "none",
								}}
								onClick={onToggleExpand}>
								<div style={{ display: "flex", alignItems: "center", gap: "10px", flexGrow: 1 }}>
									{icon}
									{title}
									<VSCodeBadge
										style={{ opacity: cost !== null && cost !== undefined && cost > 0 ? 1 : 0 }}>
										${Number(cost || 0)?.toFixed(4)}
									</VSCodeBadge>
								</div>
								<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
							</div>
							{(((cost === null || cost === undefined) && apiRequestFailedMessage) ||
								apiReqStreamingFailedMessage) && (
								<>
									<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>
										{searchText && highlightText
											? highlightText(
													apiRequestFailedMessage || apiReqStreamingFailedMessage || "",
													searchText,
													itemIndex, // Pass itemIndex
												)
											: apiRequestFailedMessage || apiReqStreamingFailedMessage}
										{apiRequestFailedMessage?.toLowerCase().includes("powershell") && (
											<>
												<br />
												<br />
												{t("chat:powershell.issues")}{" "}
												<a
													href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
													style={{ color: "inherit", textDecoration: "underline" }}>
													troubleshooting guide
												</a>
												.
											</>
										)}
									</p>
								</>
							)}

							{isExpanded && (
								<div style={{ marginTop: "10px" }}>
									<CodeAccordian
										code={safeJsonParse<any>(message.text)?.request}
										language="markdown"
										isExpanded={true}
										onToggleExpand={onToggleExpand}
										// Pass highlight props if needed inside CodeAccordian
										// searchText={searchText}
										// highlightText={highlightText}
										// itemIndex={itemIndex}
									/>
								</div>
							)}
						</>
					)
				case "api_req_finished":
					return null // we should never see this message type
				case "text":
					return (
						<div>
							{/* Remove highlight props from Markdown */}
							<Markdown markdown={message.text} partial={message.partial} searchText={searchText} />
						</div>
					)
				case "user_feedback":
					return (
						<div className="bg-vscode-editor-background border rounded-xs p-1 overflow-hidden whitespace-pre-wrap word-break-break-word overflow-wrap-anywhere">
							<div className="flex justify-between gap-2">
								<div className="flex-grow px-2 py-1">
									<Mention text={message.text} withShadow />
								</div>
								<Button
									variant="ghost"
									size="icon"
									disabled={isStreaming}
									onClick={(e) => {
										e.stopPropagation()
										vscode.postMessage({ type: "deleteMessage", value: message.ts })
									}}>
									<span className="codicon codicon-trash" />
								</Button>
							</div>
							{message.images && message.images.length > 0 && (
								<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
							)}
						</div>
					)
				case "user_feedback_diff":
					const tool = safeJsonParse<ClineSayTool>(message.text)
					return (
						<div
							style={{
								marginTop: -10,
								width: "100%",
							}}>
							<CodeAccordian
								diff={tool?.diff!}
								isFeedback={true}
								isExpanded={isExpanded}
								onToggleExpand={onToggleExpand}
								// Pass highlight props if needed inside CodeAccordian
								// searchText={searchText}
								// highlightText={highlightText}
								// itemIndex={itemIndex}
							/>
						</div>
					)
				case "error":
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>
								{searchText && highlightText
									? highlightText(message.text || "", searchText, itemIndex) // Pass itemIndex
									: message.text}
							</p>
						</>
					)
				case "completion_result":
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<div style={{ color: "var(--vscode-charts-green)", paddingTop: 10 }}>
								{/* Remove highlight props from Markdown */}
								<Markdown markdown={message.text} searchText={searchText} />
							</div>
						</>
					)
				case "shell_integration_warning":
					return <CommandExecutionError />
				case "mcp_server_response":
					return (
						<>
							<div style={{ paddingTop: 0 }}>
								<div
									style={{
										marginBottom: "4px",
										opacity: 0.8,
										fontSize: "12px",
										textTransform: "uppercase",
									}}>
									{t("chat:response")}
								</div>
								<CodeAccordian
									code={message.text}
									language="json"
									isExpanded={true}
									onToggleExpand={onToggleExpand}
									// Pass highlight props if needed inside CodeAccordian
									// searchText={searchText}
									// highlightText={highlightText}
									// itemIndex={itemIndex}
								/>
							</div>
						</>
					)
				case "checkpoint_saved":
					return (
						<CheckpointSaved
							ts={message.ts!}
							commitHash={message.text!}
							currentHash={currentCheckpoint}
							checkpoint={message.checkpoint}
							searchText={searchText} // Pass searchText
							highlightText={highlightText} // Pass highlightText
							itemIndex={itemIndex} // Pass itemIndex
						/>
					)
				default:
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 10 }}>
								<Markdown markdown={message.text} partial={message.partial} searchText={searchText} />
							</div>
						</>
					)
			}
		case "ask":
			switch (message.ask) {
				case "mistake_limit_reached":
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>
								{searchText && highlightText
									? highlightText(message.text || "", searchText, itemIndex) // Pass itemIndex
									: message.text}
							</p>
						</>
					)
				case "command":
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<CommandExecution executionId={message.progressStatus?.id} text={message.text} />
						</>
					)
				case "use_mcp_server":
					const useMcpServer = safeJsonParse<ClineAskUseMcpServer>(message.text)

					if (!useMcpServer) {
						return null
					}

					const server = mcpServers.find((server) => server.name === useMcpServer.serverName)

					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<div
								style={{
									background: "var(--vscode-textCodeBlock-background)",
									borderRadius: "3px",
									padding: "8px 10px",
									marginTop: "8px",
								}}>
								{useMcpServer.type === "access_mcp_resource" && (
									<McpResourceRow
										item={{
											// Use the matched resource/template details, with fallbacks
											...(findMatchingResourceOrTemplate(
												useMcpServer.uri || "",
												server?.resources,
												server?.resourceTemplates,
											) || {
												name: "",
												mimeType: "",
												description: "",
											}),
											// Always use the actual URI from the request
											uri: useMcpServer.uri || "",
										}}
									/>
								)}
								{useMcpServer.type === "use_mcp_tool" && (
									<>
										<div onClick={(e) => e.stopPropagation()}>
											<McpToolRow
												tool={{
													name: useMcpServer.toolName || "",
													description:
														server?.tools?.find(
															(tool) => tool.name === useMcpServer.toolName,
														)?.description || "",
													alwaysAllow:
														server?.tools?.find(
															(tool) => tool.name === useMcpServer.toolName,
														)?.alwaysAllow || false,
												}}
												serverName={useMcpServer.serverName}
												alwaysAllowMcp={alwaysAllowMcp}
											/>
										</div>
										{useMcpServer.arguments && useMcpServer.arguments !== "{}" && (
											<div style={{ marginTop: "8px" }}>
												<div
													style={{
														marginBottom: "4px",
														opacity: 0.8,
														fontSize: "12px",
														textTransform: "uppercase",
													}}>
													{t("chat:arguments")}
												</div>
												<CodeAccordian
													code={useMcpServer.arguments}
													language="json"
													isExpanded={true}
													onToggleExpand={onToggleExpand}
													// Pass highlight props if needed inside CodeAccordian
													// searchText={searchText}
													// highlightText={highlightText}
													// itemIndex={itemIndex}
												/>
											</div>
										)}
									</>
								)}
							</div>
						</>
					)
				case "completion_result":
					if (message.text) {
						return (
							<div>
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
								<div style={{ color: "var(--vscode-charts-green)", paddingTop: 10 }}>
									{/* Remove highlight props from Markdown */}
									<Markdown
										markdown={message.text}
										partial={message.partial}
										searchText={searchText}
									/>
								</div>
							</div>
						)
					} else {
						return null // Don't render anything when we get a completion_result ask without text
					}
				case "followup":
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 10, paddingBottom: 15 }}>
								{/* Pass highlight props to Markdown */}
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
									searchText={searchText}
									// Remove highlight props from Markdown
									// highlightText={highlightText}
									// itemIndex={itemIndex}
								/>
							</div>
							<FollowUpSuggest
								suggestions={followUpData?.suggest}
								onSuggestionClick={onSuggestionClick}
								ts={message?.ts}
								searchText={searchText}
								// Adapt the highlightText function signature for FollowUpSuggest
								highlightText={
									highlightText
										? (text: string, searchTerm: string) =>
												highlightText(text, searchTerm, itemIndex)
										: undefined
								}
							/>
						</>
					)
				default:
					return null
			}
	}
}
