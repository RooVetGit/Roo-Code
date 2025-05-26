import { useCallback, useEffect, useMemo, useState } from "react"
import { Server } from "lucide-react"
import { useEvent } from "react-use"

import { McpExecutionStatus, mcpExecutionStatusSchema } from "@roo/schemas"
import { ExtensionMessage, ClineAskUseMcpServer } from "@roo/shared/ExtensionMessage"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { safeJsonParse } from "@roo/shared/safeJsonParse"
import { cn } from "@src/lib/utils"
import CodeAccordian from "../common/CodeAccordian"
import McpToolRow from "../mcp/McpToolRow"

interface McpExecutionProps {
	executionId: string
	text?: string
	serverName?: string
	toolName?: string
	isArguments?: boolean
	server?: {
		tools?: Array<{
			name: string
			description?: string
			alwaysAllow?: boolean
		}>
		source?: "global" | "project"
	}
	useMcpServer?: ClineAskUseMcpServer
	alwaysAllowMcp?: boolean
}

export const McpExecution = ({
	executionId,
	text,
	serverName: initialServerName,
	toolName: initialToolName,
	isArguments = false,
	server,
	useMcpServer,
	alwaysAllowMcp = false,
}: McpExecutionProps) => {
	const { t } = useAppTranslation()

	// State for tracking MCP response status
	const [status, setStatus] = useState<McpExecutionStatus | null>(null)
	const [responseText, setResponseText] = useState(text || "")
	const [argumentsText, setArgumentsText] = useState(text || "")
	const [serverName, setServerName] = useState(initialServerName)
	const [toolName, setToolName] = useState(initialToolName)

	// Separate expanded states for arguments and response sections
	const [isArgsExpanded, setIsArgsExpanded] = useState(false)
	const [isResponseExpanded, setIsResponseExpanded] = useState(false)

	// Try to parse the text as JSON for proper formatting
	const formatJsonText = (inputText: string) => {
		if (!inputText) return ""

		try {
			// If it's already valid JSON, pretty-print it
			const parsed = safeJsonParse(inputText, null)
			if (parsed !== null) {
				return JSON.stringify(parsed, null, 2)
			}
			return inputText
		} catch (e) {
			// If parsing fails, return the original text
			return inputText
		}
	}

	const formattedResponseText = useMemo(() => formatJsonText(responseText), [responseText])
	const formattedArgumentsText = useMemo(() => formatJsonText(argumentsText), [argumentsText])

	const onToggleArgsExpand = useCallback(() => {
		setIsArgsExpanded(!isArgsExpanded)
	}, [isArgsExpanded])

	const onToggleResponseExpand = useCallback(() => {
		setIsResponseExpanded(!isResponseExpanded)
	}, [isResponseExpanded])

	// Listen for MCP execution status messages
	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "mcpExecutionStatus") {
				try {
					const result = mcpExecutionStatusSchema.safeParse(safeJsonParse(message.text || "{}", {}))

					if (result.success) {
						const data = result.data

						// Only update if this message is for our response
						if (data.executionId === executionId) {
							setStatus(data)

							if (data.status === "output" && data.response) {
								setResponseText((prev) => prev + data.response)
								// Keep the arguments when we get output
								if (isArguments && argumentsText === responseText) {
									setArgumentsText(responseText)
								}
							} else if (data.status === "completed" && data.response) {
								setResponseText(data.response)
								// Keep the arguments when we get completed response
								if (isArguments && argumentsText === responseText) {
									setArgumentsText(responseText)
								}
							}
						}
					}
				} catch (e) {
					console.error("Failed to parse MCP execution status", e)
				}
			}
		},
		[argumentsText, executionId, isArguments, responseText],
	)

	useEvent("message", onMessage)

	// Initialize with text if provided and parse command/response sections
	useEffect(() => {
		// Handle arguments text
		if (text) {
			try {
				// Try to parse the text as JSON for arguments
				const jsonObj = safeJsonParse<any>(text, null)

				if (jsonObj && typeof jsonObj === "object") {
					// Format the JSON for display
					setArgumentsText(JSON.stringify(jsonObj, null, 2))
				} else {
					// If not valid JSON, use as is
					setArgumentsText(text)
				}
			} catch (e) {
				// If parsing fails, use text as is
				setArgumentsText(text)
			}
		}

		// Handle response text
		if (useMcpServer?.response) {
			setResponseText(useMcpServer.response)
		}

		if (initialServerName && initialServerName !== serverName) {
			setServerName(initialServerName)
		}

		if (initialToolName && initialToolName !== toolName) {
			setToolName(initialToolName)
		}
	}, [text, useMcpServer, initialServerName, initialToolName, serverName, toolName, isArguments])

	return (
		<div className="w-full">
			<div className="flex items-center gap-2 text-sm">
				<Server size={16} className="text-vscode-descriptionForeground" />
				<div className="flex items-center gap-1">
					{serverName && <span className="font-medium">{serverName}</span>}
					{serverName && toolName && <span className="text-vscode-descriptionForeground">•</span>}
					{toolName && <span className="font-medium">{toolName}</span>}
				</div>

				{status && (
					<div className="flex items-center gap-2 font-mono text-xs ml-auto">
						<div
							className={cn("rounded-full size-1.5", {
								"bg-vscode-inputValidation-infoBackground": status.status === "started",
								"bg-vscode-charts-green": status.status === "completed",
								"bg-vscode-errorForeground": status.status === "error",
							})}
						/>
						<div
							className={cn({
								"text-vscode-inputValidation-infoForeground": status.status === "started",
								"text-vscode-charts-green": status.status === "completed",
								"text-vscode-errorForeground": status.status === "error",
							})}>
							{status.status === "started"
								? "Running"
								: status.status === "completed"
									? "Completed"
									: "Error"}
						</div>
						{status.status === "error" && "error" in status && status.error && (
							<div className="whitespace-nowrap">({status.error})</div>
						)}
					</div>
				)}
			</div>

			{/* Tool information section */}
			{!isArguments && useMcpServer?.type === "use_mcp_tool" && (
				<div className="bg-[var(--vscode-textCodeBlock-background)] rounded-md p-2.5 mt-2">
					<div onClick={(e) => e.stopPropagation()}>
						<McpToolRow
							tool={{
								name: useMcpServer.toolName || "",
								description:
									server?.tools?.find((tool) => tool.name === useMcpServer.toolName)?.description ||
									"",
								alwaysAllow:
									server?.tools?.find((tool) => tool.name === useMcpServer.toolName)?.alwaysAllow ||
									false,
							}}
							serverName={useMcpServer.serverName}
							serverSource={server?.source}
							alwaysAllowMcp={alwaysAllowMcp}
						/>
					</div>
				</div>
			)}
			{!isArguments && !useMcpServer && toolName && serverName && (
				<div className="bg-[var(--vscode-textCodeBlock-background)] rounded-md p-2.5 mt-2">
					<div onClick={(e) => e.stopPropagation()}>
						<McpToolRow
							tool={{
								name: toolName || "",
								description: "",
								alwaysAllow: false,
							}}
							serverName={serverName}
							serverSource={undefined}
							alwaysAllowMcp={false}
						/>
					</div>
				</div>
			)}

			{/* Arguments section - always show if we have arguments */}
			{(isArguments || useMcpServer?.arguments || argumentsText) && (
				<div className="bg-[var(--vscode-textCodeBlock-background)] rounded-md p-2.5 mt-2">
					<CodeAccordian
						code={formattedArgumentsText}
						language="json"
						isExpanded={isArgsExpanded}
						onToggleExpand={onToggleArgsExpand}
						header={t("chat:arguments")}
					/>
				</div>
			)}

			{/* Response section - only show if we have a response */}
			{responseText && (
				<div className="bg-[var(--vscode-textCodeBlock-background)] rounded-md p-2.5 mt-2">
					<CodeAccordian
						code={formattedResponseText}
						language="json"
						isExpanded={isResponseExpanded}
						onToggleExpand={onToggleResponseExpand}
						header={t("chat:response")}
					/>
				</div>
			)}
		</div>
	)
}

McpExecution.displayName = "McpExecution"
