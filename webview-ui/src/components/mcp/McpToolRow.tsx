import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { McpTool } from "@roo/mcp"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"

type McpToolRowProps = {
	tool: McpTool
	serverName?: string
	serverSource?: "global" | "project"
	alwaysAllowMcp?: boolean
}

const McpToolRow = ({ tool, serverName, serverSource, alwaysAllowMcp }: McpToolRowProps) => {
	const { t } = useAppTranslation()
	const handleAlwaysAllowChange = () => {
		if (!serverName) return
		vscode.postMessage({
			type: "toggleToolAlwaysAllow",
			serverName,
			source: serverSource || "global",
			toolName: tool.name,
			alwaysAllow: !tool.alwaysAllow,
		})
	}

	const handleEnabledForPromptChange = () => {
		if (!serverName) return
		vscode.postMessage({
			type: "toggleToolEnabledForPrompt",
			serverName,
			source: serverSource || "global",
			toolName: tool.name,
			isEnabled: !tool.enabledForPrompt,
		})
	}

	return (
		<div
			key={tool.name}
			style={{
				padding: "3px 0",
			}}>
			<div
				data-testid="tool-row-container"
				style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
				onClick={(e) => e.stopPropagation()}>
				<div style={{ display: "flex", alignItems: "center" }}>
					<span className="codicon codicon-symbol-method" style={{ marginRight: "6px" }}></span>
					<span style={{ fontWeight: 500 }}>{tool.name}</span>
				</div>
				<div className="flex items-center space-x-4">
					{" "}
					{/* Wrapper for checkboxes */}
					{serverName && (
						<div
							role="switch"
							aria-checked={tool.enabledForPrompt}
							className={`flex items-center cursor-pointer rounded-full w-8 h-4 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
								tool.enabledForPrompt ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
							}`}
							onClick={handleEnabledForPromptChange}
							data-tool-prompt-toggle={tool.name}
							title={t("mcp:tool.togglePromptInclusion")}>
							<span
								className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
									tool.enabledForPrompt ? "translate-x-4" : "translate-x-1"
								}`}
							/>
						</div>
					)}
					{serverName && alwaysAllowMcp && (
						<VSCodeCheckbox
							checked={tool.alwaysAllow}
							onChange={handleAlwaysAllowChange}
							data-tool={tool.name}>
							{t("mcp:tool.alwaysAllow")}
						</VSCodeCheckbox>
					)}
				</div>
			</div>
			{tool.description && (
				<div
					style={{
						marginLeft: "0px",
						marginTop: "4px",
						opacity: 0.8,
						fontSize: "12px",
					}}>
					{tool.description}
				</div>
			)}
			{tool.inputSchema &&
				"properties" in tool.inputSchema &&
				Object.keys(tool.inputSchema.properties as Record<string, any>).length > 0 && (
					<div
						style={{
							marginTop: "8px",
							fontSize: "12px",
							border: "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 30%, transparent)",
							borderRadius: "3px",
							padding: "8px",
						}}>
						<div
							style={{ marginBottom: "4px", opacity: 0.8, fontSize: "11px", textTransform: "uppercase" }}>
							{t("mcp:tool.parameters")}
						</div>
						{Object.entries(tool.inputSchema.properties as Record<string, any>).map(
							([paramName, schema]) => {
								const isRequired =
									tool.inputSchema &&
									"required" in tool.inputSchema &&
									Array.isArray(tool.inputSchema.required) &&
									tool.inputSchema.required.includes(paramName)

								return (
									<div
										key={paramName}
										style={{
											display: "flex",
											alignItems: "baseline",
											marginTop: "4px",
										}}>
										<code
											style={{
												color: "var(--vscode-textPreformat-foreground)",
												marginRight: "8px",
											}}>
											{paramName}
											{isRequired && (
												<span style={{ color: "var(--vscode-errorForeground)" }}>*</span>
											)}
										</code>
										<span
											style={{
												opacity: 0.8,
												overflowWrap: "break-word",
												wordBreak: "break-word",
											}}>
											{schema.description || t("mcp:tool.noDescription")}
										</span>
									</div>
								)
							},
						)}
					</div>
				)}
		</div>
	)
}

export default McpToolRow
