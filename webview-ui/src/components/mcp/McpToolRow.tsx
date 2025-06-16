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
		<div key={tool.name} className="py-2 border-b border-vscode-panel-border last:border-b-0">
			<div
				data-testid="tool-row-container"
				className="flex items-center gap-4"
				onClick={(e) => e.stopPropagation()}>
				{/* Tool name section */}
				<div className="flex items-center min-w-0 flex-1">
					<span className="codicon codicon-symbol-method mr-2 flex-shrink-0 text-vscode-symbolIcon-methodForeground"></span>
					<span className="font-medium truncate text-vscode-foreground" title={tool.name}>
						{tool.name}
					</span>
				</div>

				{/* Controls section */}
				{serverName && (
					<div className="flex items-center gap-4 flex-shrink-0">
						{/* Always Allow checkbox */}
						{alwaysAllowMcp && (
							<VSCodeCheckbox
								checked={tool.alwaysAllow}
								onChange={handleAlwaysAllowChange}
								data-tool={tool.name}
								className="text-xs">
								<span className="text-vscode-descriptionForeground whitespace-nowrap">
									{t("mcp:tool.alwaysAllow")}
								</span>
							</VSCodeCheckbox>
						)}

						{/* Enabled switch */}
						<div
							role="switch"
							aria-checked={tool.enabledForPrompt}
							aria-label={t("mcp:tool.togglePromptInclusion")}
							tabIndex={0}
							className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${
								tool.enabledForPrompt ? "bg-vscode-button-background" : "bg-vscode-input-background"
							}`}
							onClick={handleEnabledForPromptChange}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault()
									handleEnabledForPromptChange()
								}
							}}
							data-tool-prompt-toggle={tool.name}
							title={t("mcp:tool.togglePromptInclusion")}>
							<div
								className={`absolute top-0.5 h-4 w-4 rounded-full bg-vscode-button-foreground shadow-sm transition-transform ${
									tool.enabledForPrompt ? "translate-x-4" : "translate-x-0.5"
								}`}
							/>
						</div>
					</div>
				)}
			</div>
			{tool.description && (
				<div className="mt-1 text-xs text-vscode-descriptionForeground opacity-80">{tool.description}</div>
			)}
			{tool.inputSchema &&
				"properties" in tool.inputSchema &&
				Object.keys(tool.inputSchema.properties as Record<string, any>).length > 0 && (
					<div className="mt-2 text-xs border border-vscode-panel-border rounded p-2">
						<div className="mb-1 text-[11px] uppercase opacity-80 text-vscode-descriptionForeground">
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
									<div key={paramName} className="flex items-baseline mt-1">
										<code className="text-vscode-textPreformat-foreground mr-2">
											{paramName}
											{isRequired && <span className="text-vscode-errorForeground">*</span>}
										</code>
										<span className="opacity-80 break-words text-vscode-descriptionForeground">
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
