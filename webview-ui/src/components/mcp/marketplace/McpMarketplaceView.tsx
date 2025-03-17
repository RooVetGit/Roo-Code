import { useEffect, useState } from "react"
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "../../../i18n/TranslationContext"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"
import { McpMarketplaceItem } from "../../../../../src/shared/mcp"
import McpMarketplaceCard from "./McpMarketplaceCard"
import McpSubmitCard from "./McpSubmitCard"

const McpMarketplaceView = () => {
	const { t } = useAppTranslation()
	const { mcpServers } = useExtensionState()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [items, setItems] = useState<McpMarketplaceItem[]>([])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "mcpMarketplaceCatalog") {
				if (message.error) {
					setError(message.error)
				} else if (message.mcpMarketplaceCatalog) {
					setError(null)
					setItems(message.mcpMarketplaceCatalog.items)
				}
				setIsLoading(false)
			} else if (message.type === "mcpDownloadDetails") {
				if (message.error) {
					setError(message.error)
				}
			}
		}

		window.addEventListener("message", handleMessage)

		// Request marketplace data when component mounts
		vscode.postMessage({ type: "fetchMcpMarketplace" })

		return () => window.removeEventListener("message", handleMessage)
	}, [])

	if (isLoading) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "40px 20px",
				}}>
				<VSCodeProgressRing style={{ marginBottom: "16px" }} />
				<span>{t("mcp:marketplace.loading")}</span>
			</div>
		)
	}

	if (error) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "40px 20px",
					color: "var(--vscode-errorForeground)",
					textAlign: "center",
				}}>
				<span className="codicon codicon-error" style={{ fontSize: "48px", marginBottom: "16px" }} />
				<p style={{ margin: 0, marginBottom: "16px" }}>{error}</p>
				<VSCodeButton
					onClick={() => {
						setIsLoading(true)
						setError(null)
						vscode.postMessage({ type: "fetchMcpMarketplace" })
					}}>
					{t("mcp:marketplace.retry")}
				</VSCodeButton>
			</div>
		)
	}

	return (
		<div style={{ padding: "0 10px" }}>
			{items.length === 0 ? (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						padding: "40px 20px",
						color: "var(--vscode-descriptionForeground)",
						textAlign: "center",
					}}>
					<span className="codicon codicon-inbox" style={{ fontSize: "48px", marginBottom: "16px" }} />
					<p style={{ margin: 0 }}>{t("mcp:marketplace.noServers")}</p>
				</div>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						gap: "16px",
						padding: "16px 0",
					}}>
					{items.map((item) => (
						<McpMarketplaceCard key={item.mcpId} item={item} installedServers={mcpServers} />
					))}
					<McpSubmitCard />
				</div>
			)}
		</div>
	)
}

export default McpMarketplaceView
