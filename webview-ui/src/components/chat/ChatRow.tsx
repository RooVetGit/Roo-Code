import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import { useTranslation, Trans } from "react-i18next"
import deepEqual from "fast-deep-equal"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { ClineApiReqInfo, ClineAskUseMcpServer, ClineMessage, ClineSayTool } from "@roo/shared/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "@roo/shared/combineCommandSequences"
import { safeJsonParse } from "@roo/shared/safeJsonParse"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import { vscode } from "@src/utils/vscode"
import { Button } from "@src/components/ui"
import CodeAccordian, { removeLeadingNonAlphanumeric } from "../common/CodeAccordian"
import CodeBlock from "../common/CodeBlock"
import ApiRequestDetailsBlock from "./ApiRequestDetailsBlock"
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
import ViewOutputBlock from "../common/ViewOutputBlock"

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: () => void
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange"> {}

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
					onHeightChange(height > prevHeightRef.current)
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

	const [icon, title] = useMemo(() => {
		switch (type) {
			case "error":
				return [
					<span className="codicon codicon-error text-vscode-errorForeground mb-[-1.5px]"></span>,
					<span className="text-vscode-errorForeground font-bold">{t("chat:error")}</span>,
				]
			case "mistake_limit_reached":
				return [
					<span className="codicon codicon-error text-vscode-errorForeground mb-[-1.5px]"></span>,
					<span className="text-vscode-errorForeground font-bold">{t("chat:troubleMessage")}</span>,
				]
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
						<span className="codicon codicon-terminal text-vscode-foreground mb-[-1.5px]"></span>
					),
					<span className="text-vscode-foreground font-bold">{t("chat:runCommand.title")}:</span>,
				]
			case "use_mcp_server":
				const mcpServerUse = safeJsonParse<ClineAskUseMcpServer>(message.text)
				if (mcpServerUse === undefined) {
					return [null, null]
				}
				return [
					isMcpServerResponding ? (
						<ProgressIndicator />
					) : (
						<span className="codicon codicon-server text-vscode-foreground mb-[-1.5px]"></span>
					),
					<span className="text-vscode-foreground font-bold">
						{mcpServerUse.type === "use_mcp_tool"
							? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName })
							: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName })}
					</span>,
				]
			case "completion_result":
				return [
					<span className="codicon codicon-verified text-[var(--vscode-charts-green)] mb-[-1.5px]"></span>,
					<span className="text-[var(--vscode-charts-green)] font-bold">{t("chat:taskCompleted")}</span>,
				]
			case "api_req_retry_delayed":
				return []
			case "api_req_started":
				return [
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							<div className="w-4 h-4 flex items-center justify-center">
								<span
									className={`codicon codicon-error text-[var(--vscode-descriptionForeground)] text-base mb-[-1.5px]`}></span>
							</div>
						) : (
							<div className="w-4 h-4 flex items-center justify-center">
								<span
									className={`codicon codicon-error text-[var(--vscode-errorForeground)] text-base mb-[-1.5px]`}></span>
							</div>
						)
					) : cost !== null && cost !== undefined ? (
						<div className="w-4 h-4 flex items-center justify-center">
							<span
								className={`codicon codicon-check text-[var(--vscode-charts-green)] text-base mb-[-1.5px]`}></span>
						</div>
					) : apiRequestFailedMessage ? (
						<div className="w-4 h-4 flex items-center justify-center">
							<span
								className={`codicon codicon-error text-[var(--vscode-errorForeground)] text-base mb-[-1.5px]`}></span>
						</div>
					) : (
						<ProgressIndicator />
					),
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							<span className="text-vscode-foreground font-bold">{t("chat:apiRequest.cancelled")}</span>
						) : (
							<span className="text-vscode-errorForeground font-bold">
								{t("chat:apiRequest.streamingFailed")}
							</span>
						)
					) : cost !== null && cost !== undefined ? (
						<span className="text-vscode-foreground font-bold">{t("chat:apiRequest.title")}</span>
					) : apiRequestFailedMessage ? (
						<span className="text-vscode-errorForeground font-bold">{t("chat:apiRequest.failed")}</span>
					) : (
						<span className="text-vscode-foreground font-bold">{t("chat:apiRequest.streaming")}</span>
					),
				]
			case "followup":
				return [
					<span className="codicon codicon-question text-vscode-foreground mb-[-1.5px]" />,
					<span className="text-vscode-foreground font-bold">{t("chat:questions.hasQuestion")}</span>,
				]
			default:
				return [null, null]
		}
	}, [type, isCommandExecuting, message, isMcpServerResponding, apiReqCancelReason, cost, apiRequestFailedMessage, t])

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
			<span className={`codicon codicon-${name} text-vscode-foreground mb-[-1.5px]`}></span>
		)

		switch (tool.tool) {
			case "editedExistingFile":
			case "appliedDiff":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon(tool.tool === "appliedDiff" ? "diff" : "edit")}
							<span className="font-bold">
								{tool.isOutsideWorkspace
									? t("chat:fileOperations.wantsToEditOutsideWorkspace")
									: t("chat:fileOperations.wantsToEdit")}
							</span>
						</div>
						<ViewOutputBlock
							iconName={tool.tool === "appliedDiff" ? "diff" : "edit"}
							title={t("chat:viewDiff")}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewDiff")}
						/>
					</>
				)
			case "insertContent":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("insert")}
							<span className="font-bold">
								{tool.isOutsideWorkspace
									? t("chat:fileOperations.wantsToEditOutsideWorkspace")
									: tool.lineNumber === 0
										? t("chat:fileOperations.wantsToInsertAtEnd")
										: t("chat:fileOperations.wantsToInsertWithLineNumber", {
												lineNumber: tool.lineNumber,
											})}
							</span>
						</div>
						<ViewOutputBlock
							iconName="insert"
							title={t("chat:viewChanges")}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewChanges")}
						/>
					</>
				)
			case "searchAndReplace":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("replace")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:fileOperations.wantsToSearchReplace")
									: t("chat:fileOperations.didSearchReplace")}
							</span>
						</div>
						<ViewOutputBlock
							iconName="replace"
							title={t("chat:viewDiff")}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewDiff")}
						/>
					</>
				)
			case "newFileCreated":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("new-file")}
							<span className="font-bold">{t("chat:fileOperations.wantsToCreate")}</span>
						</div>
						<ViewOutputBlock
							iconName="new-file"
							title={t("chat:viewFileContent")}
							content={tool.content || ""}
							language={tool.path?.split(".").pop() || "txt"}
							filePath={tool.path}
							tooltip={t("chat:viewFileContent")}
						/>
					</>
				)
			case "readFile":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("file-code")}
							<span className="font-bold">
								{message.type === "ask"
									? tool.isOutsideWorkspace
										? t("chat:fileOperations.wantsToReadOutsideWorkspace")
										: t("chat:fileOperations.wantsToRead")
									: t("chat:fileOperations.didRead")}
							</span>
						</div>
						<div className="min-h-7 rounded py-2 px-3 items-center cursor-pointer select-none border bg-vscode-editor-background  border-sky-300/50">
							<div
								className="flex items-center gap-4 cursor-pointer select-none rounded"
								onClick={() => {
									vscode.postMessage({ type: "openFile", text: tool.content })
								}}>
								{tool.path?.startsWith(".") && <span>.</span>}
								<span className={`codicon codicon-file  text-sky-300/70`}></span>
								<span
									className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 text-left"
									style={{ direction: "rtl" }}>
									{removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"}
									{tool.reason}
								</span>
								<div className="flex-grow"></div>
								<span className={`codicon codicon-link-external text-[13.5px] my-[1px]`}></span>
							</div>
						</div>
					</>
				)
			case "fetchInstructions":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("file-code")}
							<span className="font-bold">{t("chat:instructions.wantsToFetch")}</span>
						</div>
						<CodeAccordian
							isLoading={message.partial}
							code={tool.content!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
						/>
					</>
				)
			case "listFilesTopLevel":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("folder-opened")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewTopLevel")
									: t("chat:directoryOperations.didViewTopLevel")}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							language="shell-session"
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
						/>
					</>
				)
			case "listFilesRecursive":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("folder-opened")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewRecursive")
									: t("chat:directoryOperations.didViewRecursive")}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							language="shell-session"
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
						/>
					</>
				)
			case "listCodeDefinitionNames":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("file-code")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewDefinitions")
									: t("chat:directoryOperations.didViewDefinitions")}
							</span>
						</div>
						<CodeAccordian
							code={tool.content!}
							path={tool.path!}
							isExpanded={isExpanded}
							onToggleExpand={onToggleExpand}
						/>
					</>
				)
			case "searchFiles":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("search")}
							<span className="font-bold">
								{message.type === "ask" ? (
									<Trans
										i18nKey="chat:directoryOperations.wantsToSearch"
										components={{ code: <code>{tool.regex}</code> }}
										values={{ regex: tool.regex }}
									/>
								) : (
									<Trans
										i18nKey="chat:directoryOperations.didSearch"
										components={{ code: <code>{tool.regex}</code> }}
										values={{ regex: tool.regex }}
									/>
								)}
							</span>
						</div>
						<ViewOutputBlock
							iconName="search"
							title={t("chat:directoryOperations.viewSearchResults")}
							content={tool.content || ""}
							language="plaintext"
							filePath={tool.path}
							tooltip={t("chat:directoryOperations.viewSearchResults")}
						/>
					</>
				)
			case "switchMode":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("symbol-enum")}
							<span className="font-bold">
								{message.type === "ask" ? (
									<>
										{tool.reason ? (
											<Trans
												i18nKey="chat:modes.wantsToSwitchWithReason"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode, reason: tool.reason }}
											/>
										) : (
											<Trans
												i18nKey="chat:modes.wantsToSwitch"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode }}
											/>
										)}
									</>
								) : (
									<>
										{tool.reason ? (
											<Trans
												i18nKey="chat:modes.didSwitchWithReason"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode, reason: tool.reason }}
											/>
										) : (
											<Trans
												i18nKey="chat:modes.didSwitch"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode }}
											/>
										)}
									</>
								)}
							</span>
						</div>
					</>
				)
			case "newTask":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("tasklist")}
							<span className="font-bold">
								<Trans
									i18nKey="chat:subtasks.wantsToCreate"
									components={{ code: <code>{tool.mode}</code> }}
									values={{ mode: tool.mode }}
								/>
							</span>
						</div>
						<div className="mt-1 bg-vscode-badge-background border border-vscode-badge-background rounded-t-[4px] overflow-hidden mb-[2px]">
							<div className="py-[9px] pl-[14px] pr-[10px] bg-vscode-badge-background border-b border-vscode-editorGroup-border font-bold text-vscode-font-size text-vscode-badge-foreground flex items-center gap-[6px]">
								<span className="codicon codicon-arrow-right"></span>
								{t("chat:subtasks.newTaskContent")}
							</div>
							<div className="px-4 py-3 bg-vscode-editor-background">
								<MarkdownBlock markdown={tool.content} />
							</div>
						</div>
					</>
				)
			case "finishTask":
				return (
					<>
						<div className="flex items-center gap-[10px] mb-[10px] break-words">
							{toolIcon("check-all")}
							<span className="font-bold">{t("chat:subtasks.wantsToFinish")}</span>
						</div>
						<div className="mt-1 bg-vscode-editor-background border border-vscode-badge-background rounded-[4px] overflow-hidden mb-2">
							<div className="py-[9px] pl-[14px] pr-[10px] bg-vscode-badge-background border-b border-vscode-editorGroup-border font-bold text-vscode-font-size text-vscode-badge-foreground flex items-center gap-[6px]">
								<span className="codicon codicon-check"></span>
								{t("chat:subtasks.completionContent")}
							</div>
							<div className="px-4 py-3 bg-vscode-editor-background">
								<MarkdownBlock markdown={t("chat:subtasks.completionInstructions")} />
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
						<div className="mt-0 overflow-hidden mb-2">
							<div
								className={`font-normal text-vscode-font-size text-vscode-editor-foreground flex items-center justify-between cursor-pointer ${isDiffErrorExpanded ? "border-b border-vscode-editorGroup-border" : ""}`}
								onClick={() => setIsDiffErrorExpanded(!isDiffErrorExpanded)}>
								<div className="flex items-center gap-[10px] flex-grow">
									<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base mb-[-1.5px]"></span>
									<span className="font-bold">{t("chat:diffError.title")}</span>
								</div>
								<div className="flex items-center">
									<VSCodeButton
										appearance="icon"
										className="p-[3px] h-6 mr-1 text-vscode-editor-foreground flex items-center justify-center bg-transparent"
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
								<div className="p-2 bg-vscode-editor-background border-t-0">
									<CodeBlock source={`${"```"}plaintext\n${message.text || ""}\n${"```"}`} />
								</div>
							)}
						</div>
					)
				case "subtask_result":
					return (
						<div className="mt-0 bg-vscode-badge-background border border-vscode-badge-background rounded-b-[4px] overflow-hidden mb-2">
							<div className="py-[9px] pl-[14px] pr-[10px] bg-vscode-badge-background border-b border-vscode-editorGroup-border font-bold text-vscode-font-size text-vscode-badge-foreground flex items-center gap-[6px]">
								<span className="codicon codicon-arrow-left"></span>
								{t("chat:subtasks.resultContent")}
							</div>
							<div className="px-4 py-3 bg-vscode-editor-background">
								<MarkdownBlock markdown={message.text} />
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
							{(((cost === null || cost === undefined) && apiRequestFailedMessage) ||
								apiReqStreamingFailedMessage) && (
								<>
									<div className={`$"flex items-center gap-[10px] mb-[10px] break-words"`}>
										{icon}
										{title}
									</div>

									<p
										className={`"m-0 whitespace-pre-wrap break-words [overflowWrap:anywhere] text-vscode-errorForeground mb-[10px]`}>
										{apiRequestFailedMessage || apiReqStreamingFailedMessage}
										{apiRequestFailedMessage?.toLowerCase().includes("powershell") && (
											<>
												<br />
												<br />
												{t("chat:powershell.issues")}{" "}
												<a
													href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
													className="text-inherit underline">
													{t("chat:shellIntegration.troubleshootingGuide")}
												</a>
												.
											</>
										)}
									</p>
								</>
							)}
							<ApiRequestDetailsBlock
								message={message}
								icon={icon}
								cost={cost}
								apiRequestFailedMessage={apiRequestFailedMessage}
								apiReqStreamingFailedMessage={apiReqStreamingFailedMessage}
							/>
						</>
					)
				case "api_req_finished":
					return null // we should never see this message type
				case "text":
					return (
						<div>
							<Markdown markdown={message.text} partial={message.partial} />
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
						<div className="-mt-[10px] w-full">
							<ViewOutputBlock
								iconName="diff"
								title={t("chat:viewFeedbackDiff")}
								content={tool?.diff || ""}
								language="diff"
								tooltip={t("chat:viewFeedbackDiff")}
							/>
						</div>
					)
				case "error":
					return (
						<>
							{title && (
								<div className="flex items-center gap-[10px] mb-[10px] break-words">
									{icon}
									{title}
								</div>
							)}
							<p
								className={`"m-0 whitespace-pre-wrap break-words [overflowWrap:anywhere] text-vscode-errorForeground`}>
								{message.text}
							</p>
						</>
					)
				case "completion_result":
					return (
						<>
							<div className="flex items-center gap-[10px] mb-[10px] break-words">
								{icon}
								{title}
							</div>
							<div className="text-vscode-charts-green pt-[10px]">
								<Markdown markdown={message.text} />
							</div>
						</>
					)
				case "shell_integration_warning":
					return <CommandExecutionError />
				case "mcp_server_response":
					return (
						<>
							<div className="pt-0">
								<div className="mb-1 opacity-80 text-xs uppercase">{t("chat:response")}</div>
								<CodeAccordian
									code={message.text}
									language="json"
									isExpanded={true}
									onToggleExpand={onToggleExpand}
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
						/>
					)
				default:
					return (
						<>
							{title && (
								<div className="flex items-center gap-[10px] mb-[10px] break-words">
									{icon}
									{title}
								</div>
							)}
							<div className="pt-[10px]">
								<Markdown markdown={message.text} partial={message.partial} />
							</div>
						</>
					)
			}
		case "ask":
			switch (message.ask) {
				case "mistake_limit_reached":
					return (
						<>
							<div className="flex items-center gap-[10px] mb-[10px] break-words">
								{icon}
								{title}
							</div>
							<p
								className={`"m-0 whitespace-pre-wrap break-words [overflowWrap:anywhere] text-vscode-errorForeground`}>
								{message.text}
							</p>
						</>
					)
				case "command":
					return (
						<CommandExecution
							executionId={message.ts.toString()}
							text={message.text}
							icon={icon}
							title={title}
						/>
					)
				case "use_mcp_server":
					const useMcpServer = safeJsonParse<ClineAskUseMcpServer>(message.text)

					if (!useMcpServer) {
						return null
					}

					const server = mcpServers.find((server) => server.name === useMcpServer.serverName)

					return (
						<>
							<div className="flex items-center gap-[10px] mb-[10px] break-words">
								{icon}
								{title}
							</div>

							<div className="bg-vscode-textCodeBlock-background rounded-lg px-4 py-2 mt-4">
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
												serverSource={server?.source}
												alwaysAllowMcp={alwaysAllowMcp}
											/>
										</div>
										{useMcpServer.arguments && useMcpServer.arguments !== "{}" && (
											<div className="mt-2">
												<div className="mb-1 opacity-80 text-xs uppercase">
													{t("chat:arguments")}
												</div>
												<CodeAccordian
													code={useMcpServer.arguments}
													language="json"
													isExpanded={true}
													onToggleExpand={onToggleExpand}
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
								<div className="flex items-center gap-[10px] mb-[10px] break-words">
									{icon}
									{title}
								</div>
								<div className="text-vscode-charts-green pt-[10px]">
									<Markdown markdown={message.text} partial={message.partial} />
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
								<div className="flex items-center gap-[10px] mb-[10px] break-words">
									{icon}
									{title}
								</div>
							)}
							<div className="pt-[10px] pb-[15px]">
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
								/>
							</div>
							<FollowUpSuggest
								suggestions={followUpData?.suggest}
								onSuggestionClick={onSuggestionClick}
								ts={message?.ts}
							/>
						</>
					)
				default:
					return null
			}
	}
}
