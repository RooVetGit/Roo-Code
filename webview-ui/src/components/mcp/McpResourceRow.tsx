import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { McpResource, McpResourceTemplate } from "@roo/mcp"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"

type McpResourceRowProps = {
	item: McpResource | McpResourceTemplate
	serverName?: string
	serverSource?: "global" | "project"
	alwaysAllowMcp?: boolean
	isInChatContext?: boolean
}

const McpResourceRow = ({
	item,
	serverName,
	serverSource,
	alwaysAllowMcp,
	isInChatContext = false,
}: McpResourceRowProps) => {
	const { t } = useAppTranslation()
	const hasUri = "uri" in item
	const uri = hasUri ? item.uri : item.uriTemplate

	const handleAlwaysAllowChange = () => {
		if (!serverName) return
		vscode.postMessage({
			type: "toggleResourceAlwaysAllow",
			serverName,
			source: serverSource || "global",
			resourceUri: uri,
			alwaysAllow: !item.alwaysAllow,
		})
	}

	return (
		<div key={uri} className="py-2 border-b border-vscode-panel-border last:border-b-0">
			<div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
				{/* Resource URI section */}
				<div className="flex items-center min-w-0 flex-1">
					<span className="codicon codicon-symbol-file mr-2 flex-shrink-0 text-vscode-symbolIcon-fileForeground" />
					<span className="font-medium break-all text-vscode-foreground">{uri}</span>
				</div>

				{/* Controls section */}
				{serverName && alwaysAllowMcp && !isInChatContext && (
					<div className="flex items-center flex-shrink-0">
						<VSCodeCheckbox
							checked={item.alwaysAllow}
							onChange={handleAlwaysAllowChange}
							data-resource={uri}
							className="text-xs">
							<span className="text-vscode-descriptionForeground whitespace-nowrap">
								{t("mcp:resource.alwaysAllow")}
							</span>
						</VSCodeCheckbox>
					</div>
				)}
			</div>

			{/* Description section */}
			<div className="mt-1 text-xs text-vscode-descriptionForeground opacity-80">
				{item.name && item.description
					? `${item.name}: ${item.description}`
					: !item.name && item.description
						? item.description
						: !item.description && item.name
							? item.name
							: "No description"}
			</div>

			{/* MIME type section */}
			<div className="mt-2 text-xs">
				<span className="text-vscode-descriptionForeground opacity-80">Returns </span>
				<code className="text-vscode-textPreformat-foreground bg-vscode-textPreformat-background px-1 py-0.5 rounded">
					{item.mimeType || "Unknown"}
				</code>
			</div>
		</div>
	)
}

export default McpResourceRow
