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
		<div
			key={uri}
			style={{
				padding: "3px 0",
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					marginBottom: "4px",
				}}>
				<span className={`codicon codicon-symbol-file`} style={{ marginRight: "6px" }} />
				<span style={{ fontWeight: 500, wordBreak: "break-all" }}>{uri}</span>
			</div>
			<div
				style={{
					fontSize: "12px",
					opacity: 0.8,
					margin: "4px 0",
				}}>
				{item.name && item.description
					? `${item.name}: ${item.description}`
					: !item.name && item.description
						? item.description
						: !item.description && item.name
							? item.name
							: "No description"}
			</div>
			<div
				style={{
					fontSize: "12px",
				}}>
				<span style={{ opacity: 0.8 }}>Returns </span>
				<code
					style={{
						color: "var(--vscode-textPreformat-foreground)",
						background: "var(--vscode-textPreformat-background)",
						padding: "1px 4px",
						borderRadius: "3px",
					}}>
					{item.mimeType || "Unknown"}
				</code>
			</div>
			{serverName && alwaysAllowMcp && !isInChatContext && (
				<div style={{ marginTop: "8px" }}>
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
	)
}

export default McpResourceRow
