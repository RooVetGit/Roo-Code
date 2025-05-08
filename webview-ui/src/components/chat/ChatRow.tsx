import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import { useTranslation, Trans } from "react-i18next"
import deepEqual from "fast-deep-equal"
import { VSCodeBadge, VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { ClineApiReqInfo, ClineAskUseMcpServer, ClineMessage, ClineSayTool } from "@roo/shared/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "@roo/shared/combineCommandSequences"
import { safeJsonParse } from "@roo/shared/safeJsonParse"

import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@src/utils/clipboard"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import { vscode } from "@src/utils/vscode"
import { Button } from "@src/components/ui"
<<<<<<< HEAD

import CodeAccordian, { removeLeadingNonAlphanumeric } from "../common/CodeAccordian"
=======
import CodeAccordian, { removeLeadingNonAlphanumeric } from "../common/CodeAccordian" // Restore CodeAccordian import
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
	// isExpanded, // Removed unused prop
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

<<<<<<< HEAD
	const [icon, title] = useMemo((): [React.ReactNode | null, React.ReactNode | null] => {
		switch (type) {
			case "error":
				return [
					<span className="codicon codicon-error text-vscode-errorForeground mb-[-1.5px]" />,
					<span className="font-bold text-vscode-errorForeground">{t("chat:error")}</span>,
				]
			case "mistake_limit_reached":
				return [
					<span className="codicon codicon-error text-vscode-errorForeground mb-[-1.5px]" />, // Self-closing
					<span className="font-bold text-vscode-errorForeground">{t("chat:troubleMessage")}</span>,
=======
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	const [icon, title] = useMemo(() => {
		switch (type) {
			case "error":
				return [
					<span className="codicon codicon-error text-[var(--vscode-errorForeground)] mb-[-1.5px]"></span>,
					<span className="text-[var(--vscode-errorForeground)] font-bold">{t("chat:error")}</span>,
				]
			case "mistake_limit_reached":
				return [
					<span className="codicon codicon-error text-[var(--vscode-errorForeground)] mb-[-1.5px]"></span>,
					<span className="text-[var(--vscode-errorForeground)] font-bold">{t("chat:troubleMessage")}</span>,
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
				]
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
<<<<<<< HEAD
						<span className="codicon codicon-terminal text-vscode-foreground mb-[-1.5px]" /> // Self-closing
					),
					<span className="font-bold text-vscode-foreground">{t("chat:runCommand.title")}:</span>,
=======
						<span className="codicon codicon-terminal text-[var(--vscode-foreground)] mb-[-1.5px]"></span>
					),
					<span className="text-[var(--vscode-foreground)] font-bold">{t("chat:runCommand.title")}:</span>,
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
						<span className="codicon codicon-server text-vscode-foreground mb-[-1.5px]" /> // Self-closing
					),
					<span className="font-bold text-vscode-foreground">
=======
						<span className="codicon codicon-server text-[var(--vscode-foreground)] mb-[-1.5px]"></span>
					),
					<span className="text-[var(--vscode-foreground)] font-bold">
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
						{mcpServerUse.type === "use_mcp_tool"
							? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName })
							: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName })}
					</span>,
				]
			case "completion_result":
				return [
<<<<<<< HEAD
					<span className="codicon codicon-check text-vscode-charts-green mb-[-1.5px]" />, // Self-closing
					<span className="font-bold text-vscode-charts-green">{t("chat:taskCompleted")}</span>,
=======
					<span className="codicon codicon-verified text-[var(--vscode-charts-green)] mb-[-1.5px]"></span>,
					<span className="text-[var(--vscode-charts-green)] font-bold">{t("chat:taskCompleted")}</span>,
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
				]
			case "api_req_retry_delayed":
				return [null, null] // Explicitly return [null, null] for this case
			case "api_req_started":
<<<<<<< HEAD
				const getIconSpan = (iconName: string, colorClassName: string) => (
					<div className="w-4 h-4 flex items-center justify-center">
						<span className={`codicon codicon-${iconName} ${colorClassName} text-[16px] mb-[-1.5px]`} />
=======
				const getIconSpan = (iconName: string, color: string) => (
					<div className="w-4 h-4 flex items-center justify-center">
						<span className={`codicon codicon-${iconName} text-[${color}] text-base mb-[-1.5px]`}></span>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
					</div>
				)
				return [
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							getIconSpan("error", "text-vscode-descriptionForeground")
						) : (
							getIconSpan("error", "text-vscode-errorForeground")
						)
					) : cost !== null && cost !== undefined ? (
						getIconSpan("check", "text-vscode-charts-green")
					) : apiRequestFailedMessage ? (
						getIconSpan("error", "text-vscode-errorForeground")
					) : (
						<ProgressIndicator />
					),
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
<<<<<<< HEAD
							<span className="font-bold text-vscode-foreground">{t("chat:apiRequest.cancelled")}</span>
						) : (
							<span className="font-bold text-vscode-errorForeground">
=======
							<span className="text-[var(--vscode-foreground)] font-bold">
								{t("chat:apiRequest.cancelled")}
							</span>
						) : (
							<span className="text-[var(--vscode-errorForeground)] font-bold">
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
								{t("chat:apiRequest.streamingFailed")}
							</span>
						)
					) : cost !== null && cost !== undefined ? (
<<<<<<< HEAD
						<span className="font-bold text-vscode-foreground">{t("chat:apiRequest.title")}</span>
					) : apiRequestFailedMessage ? (
						<span className="font-bold text-vscode-errorForeground">{t("chat:apiRequest.failed")}</span>
					) : (
						<span className="font-bold text-vscode-foreground">{t("chat:apiRequest.streaming")}</span>
=======
						<span className="text-[var(--vscode-foreground)] font-bold">{t("chat:apiRequest.title")}</span>
					) : apiRequestFailedMessage ? (
						<span className="text-[var(--vscode-errorForeground)] font-bold">
							{t("chat:apiRequest.failed")}
						</span>
					) : (
						<span className="text-[var(--vscode-foreground)] font-bold">
							{t("chat:apiRequest.streaming")}
						</span>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
					),
				]
			case "followup":
				return [
<<<<<<< HEAD
					<span className="codicon codicon-question text-vscode-foreground mb-[-1.5px]" />,
					<span className="font-bold text-vscode-foreground">{t("chat:questions.hasQuestion")}</span>,
=======
					<span className="codicon codicon-question text-[var(--vscode-foreground)] mb-[-1.5px]" />,
					<span className="text-[var(--vscode-foreground)] font-bold">
						{t("chat:questions.hasQuestion")}
					</span>,
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
				]
			default:
				return [null, null] // Explicitly return [null, null] for default case
		}
	}, [type, isCommandExecuting, message, isMcpServerResponding, apiReqCancelReason, cost, apiRequestFailedMessage, t])

<<<<<<< HEAD
	const headerClasses = "flex items-center gap-[10px] mb-[10px] break-words"
	const pClasses = "m-0 whitespace-pre-wrap break-words overflow-anywhere"
=======
	const headerClassName = "flex items-center gap-[10px] mb-[10px] break-words"

	const pStyle: React.CSSProperties = {
		// Keep overflowWrap: "anywhere" as style
		margin: 0,
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
		overflowWrap: "anywhere",
	}
	const pClassName = "m-0 whitespace-pre-wrap break-words"
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)

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
<<<<<<< HEAD
			<span className={`codicon codicon-${name} text-vscode-foreground mb-[-1.5px]`} /> // Converted to Tailwind & self-closing
=======
			<span className={`codicon codicon-${name} text-vscode-foreground mb-[-1.5px]`}></span>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
		)

		switch (tool.tool) {
			case "editedExistingFile":
			case "appliedDiff":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon(tool.tool === "appliedDiff" ? "diff" : "edit")}
							<span className="font-bold">
								{tool.isOutsideWorkspace
									? t("chat:fileOperations.wantsToEditOutsideWorkspace")
									: t("chat:fileOperations.wantsToEdit")}
							</span>
						</div>
						<ViewOutputBlock
							iconName={tool.tool === "appliedDiff" ? "diff" : "edit"}
							title={t("chat:viewDiff") ?? "View Diff"}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewDiff") ?? "View Diff"}
						/>
					</>
				)
			case "insertContent":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
							title={t("chat:viewChanges") ?? "View Changes"}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewChanges") ?? "View Changes"}
						/>
					</>
				)
			case "searchAndReplace":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("replace")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:fileOperations.wantsToSearchReplace")
									: t("chat:fileOperations.didSearchReplace")}
							</span>
						</div>
						<ViewOutputBlock
							iconName="replace"
							title={t("chat:viewDiff") ?? "View Diff"}
							content={tool.diff || ""}
							language="diff"
							filePath={tool.path}
							tooltip={t("chat:viewDiff") ?? "View Diff"}
						/>
					</>
				)
			case "newFileCreated":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("new-file")}
							<span className="font-bold">{t("chat:fileOperations.wantsToCreate")}</span>
						</div>
						<ViewOutputBlock
							iconName="new-file"
							title={t("chat:viewFileContent") ?? "View File Content"}
							content={tool.content || ""}
							language={tool.path?.split(".").pop() || "txt"}
							filePath={tool.path}
							tooltip={t("chat:viewFileContent") ?? "View File Content"}
						/>
					</>
				)
			case "readFile":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("file-code")}
							<span className="font-bold">
								{message.type === "ask"
									? tool.isOutsideWorkspace
										? t("chat:fileOperations.wantsToReadOutsideWorkspace")
										: t("chat:fileOperations.wantsToRead")
									: t("chat:fileOperations.didRead")}
							</span>
						</div>
<<<<<<< HEAD
						<div className="rounded-[3px] overflow-hidden border border-vscode-editorGroup-border bg-vscode-code-block-background">
							<div
								className="text-vscode-descriptionForeground flex items-center p-[9px_10px] cursor-pointer select-none"
=======
						<div className="roo-tool-use border-sky-300/50">
							{/* Keep userSelect styles for cross-browser compatibility */}
							<div
								className="flex items-center gap-4 cursor-pointer select-none rounded"
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
								onClick={() => {
									vscode.postMessage({ type: "openFile", text: tool.content })
								}}>
								{tool.path?.startsWith(".") && <span>.</span>}
<<<<<<< HEAD
								<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 rtl text-left">
=======
								{/* Keep direction: rtl as style */}
								<span className={`codicon codicon-file  text-sky-300/70`}></span>
								<span
									className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 text-left"
									style={{ direction: "rtl" }}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
									{removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"}
									{tool.reason}
								</span>
								<div className="flex-grow"></div>
<<<<<<< HEAD
								<span className="codicon codicon-link-external text-[13.5px] m-[1px_0]"></span>
=======
								<span className={`codicon codicon-link-external text-[13.5px] my-[1px]`}></span>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							</div>
						</div>
					</>
				)
			case "fetchInstructions":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("file-code")}
							<span className="font-bold">{t("chat:instructions.wantsToFetch")}</span>
						</div>
						<ViewOutputBlock
							iconName="book"
							title={t("chat:instructions.viewInstructions") ?? "View Instructions"}
							content={tool.content || ""}
							language="markdown"
							tooltip={t("chat:instructions.viewInstructions") ?? "View Instructions"}
						/>
					</>
				)
			case "listFilesTopLevel":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("folder-opened")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewTopLevel")
									: t("chat:directoryOperations.didViewTopLevel")}
							</span>
						</div>
						<ViewOutputBlock
							iconName="folder-opened"
							title={t("chat:directoryOperations.viewFileList") ?? "View File List"}
							content={tool.content || ""}
							language="plaintext"
							filePath={tool.path}
							tooltip={t("chat:directoryOperations.viewFileList") ?? "View File List"}
						/>
					</>
				)
			case "listFilesRecursive":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("folder-opened")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewRecursive")
									: t("chat:directoryOperations.didViewRecursive")}
							</span>
						</div>
						<ViewOutputBlock
							iconName="folder-opened"
							title={t("chat:directoryOperations.viewFileList") ?? "View File List"}
							content={tool.content || ""}
							language="plaintext"
							filePath={tool.path}
							tooltip={t("chat:directoryOperations.viewFileList") ?? "View File List"}
						/>
					</>
				)
			case "listCodeDefinitionNames":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
							{toolIcon("file-code")}
							<span className="font-bold">
								{message.type === "ask"
									? t("chat:directoryOperations.wantsToViewDefinitions")
									: t("chat:directoryOperations.didViewDefinitions")}
							</span>
						</div>
						<ViewOutputBlock
							iconName="symbol-class"
							title={t("chat:directoryOperations.viewDefinitions") ?? "View Definitions"}
							content={tool.content || ""}
							language="plaintext"
							filePath={tool.path}
							tooltip={t("chat:directoryOperations.viewDefinitions") ?? "View Definitions"}
						/>
					</>
				)
			case "searchFiles":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
							title={t("chat:directoryOperations.viewSearchResults") ?? "View Search Results"}
							content={tool.content || ""}
							language="plaintext"
							filePath={tool.path}
							tooltip={t("chat:directoryOperations.viewSearchResults") ?? "View Search Results"}
						/>
					</>
				)
			case "switchMode":
				return (
					<>
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
						<div className={headerClasses}>
=======
						<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
							<div
								className={cn(
									headerClasses,
									"justify-between cursor-pointer select-none",
									((cost === null || cost === undefined) && apiRequestFailedMessage) ||
										apiReqStreamingFailedMessage
										? "mb-[10px]"
										: "mb-0",
								)}
								onClick={onToggleExpand}>
								<div className="flex items-center gap-[10px] flex-grow">
									{icon}
									{title}
									<VSCodeBadge
										style={{ opacity: cost !== null && cost !== undefined && cost > 0 ? 1 : 0 }}>
										${Number(cost || 0)?.toFixed(4)}
									</VSCodeBadge>
								</div>
							</div>
							{(((cost === null || cost === undefined) && apiRequestFailedMessage) ||
								apiReqStreamingFailedMessage) && (
								<>
<<<<<<< HEAD
									<p className={cn(pClasses, "text-vscode-errorForeground")}>
=======
									{/* Display the original icon and title for context when there's an error */}
									<div className={`${headerClassName} mb-[10px]`}>
										{icon}
										{title}
									</div>
									{/* Keep pStyle for overflowWrap */}
									<p style={pStyle} className={`${pClassName} text-vscode-errorForeground mb-[10px]`}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
								title={t("chat:viewFeedbackDiff") ?? "View Feedback Diff"}
								content={tool?.diff || ""}
								language="diff"
								tooltip={t("chat:viewFeedbackDiff") ?? "View Feedback Diff"}
							/>
						</div>
					)
				case "error":
					return (
						<>
							{title && (
<<<<<<< HEAD
								<div className={headerClasses}>
=======
								<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
									{icon}
									{title}
								</div>
							)}
<<<<<<< HEAD
							<p className={cn(pClasses, "text-vscode-errorForeground")}>{message.text}</p>
=======
							{/* Keep pStyle for overflowWrap */}
							<p style={pStyle} className={`${pClassName} text-vscode-errorForeground`}>
								{message.text}
							</p>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
						</>
					)
				case "completion_result":
					return (
						<>
<<<<<<< HEAD
							<div className={headerClasses}>
=======
							<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
								{icon}
								{title}
							</div>
							<div className="text-vscode-charts-green pt-[10px]">
								<Markdown markdown={message.text} />
							</div>
						</>
					)
				case "shell_integration_warning":
<<<<<<< HEAD
					return <CommandExecutionError />
=======
					return (
						<>
							<div className="flex flex-col bg-[rgba(255,191,0,0.1)] p-2 rounded-[3px] text-xs">
								<div className="flex items-center mb-1">
									<i className="codicon codicon-warning mr-2 text-lg text-[#FFA500]"></i>
									<span className="font-medium text-[#FFA500]">
										{t("chat:shellIntegration.unavailable")}
									</span>
								</div>
								<div>
									<strong>{message.text}</strong>
									<br />
									<div>
										&bull; {t("chat:shellIntegration.checkSettings")}
										<br />
										&bull; {t("chat:shellIntegration.updateVSCode")} (
										<code>CMD/CTRL + Shift + P</code> → "Update")
										<br />
										&bull; {t("chat:shellIntegration.supportedShell")} (
										<code>CMD/CTRL + Shift + P</code> → "Terminal: Select Default Profile")
									</div>
									<br />
									<a
										href="http://docs.roocode.com/troubleshooting/shell-integration/"
										className="text-inherit underline">
										{t("chat:shellIntegration.troubleshooting")}
									</a>
								</div>
							</div>
						</>
					)
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
								<div className={headerClasses}>
=======
								<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
							<div className={headerClasses}>
								{icon}
								{title}
							</div>
							<p className={cn(pClasses, "text-vscode-errorForeground")}>{message.text}</p>
=======
							<div className={headerClassName}>
								{icon}
								{title}
							</div>
							{/* Keep pStyle for overflowWrap */}
							<p style={pStyle} className={`${pClassName} text-vscode-errorForeground`}>
								{message.text}
							</p>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
						</>
					)
				case "command":
					return (
						<>
<<<<<<< HEAD
							<div className={headerClasses}>
=======
							<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
								{icon}
								{title}
							</div>
							<CommandExecution executionId={message.ts.toString()} text={message.text} />
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
<<<<<<< HEAD
							<div className={headerClasses}>
								{icon}
								{title}
							</div>
							<div className="bg-vscode-textCodeBlock-background rounded-[3px] p-[8px_10px] mt-2">
=======
							<div className={headerClassName}>
								{icon}
								{title}
							</div>

							<div className="bg-vscode-textCodeBlock-background rounded-lg px-4 py-2 mt-4">
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
								<div className={headerClasses}>
=======
								<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
<<<<<<< HEAD
								<div className={headerClasses}>
=======
								<div className={headerClassName}>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
									{icon}
									{title}
								</div>
							)}
							<div className="pt-[10px] pb-[15px]">
<<<<<<< HEAD
								<p className={pClasses}>
									{message.partial === true ? message?.text : followUpData?.question}
								</p>
=======
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
								/>
>>>>>>> f21cfc2e3 (Tailwind transition + tweaks.)
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
