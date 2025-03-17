import { useEffect, useState } from "react"
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "../../i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { McpMarketplaceItem } from "../../../../src/shared/mcp"

const McpMarketplaceView = () => {
	const { t } = useAppTranslation()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [items, setItems] = useState<McpMarketplaceItem[]>([])

	useEffect(() => {
		// Request marketplace data when component mounts
		vscode.postMessage({ type: "fetchMcpMarketplace" })

		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "mcpMarketplaceCatalog") {
				setIsLoading(false)
				if (message.error) {
					setError(message.error)
				} else if (message.mcpMarketplaceCatalog) {
					setItems(message.mcpMarketplaceCatalog.items)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleInstall = (mcpId: string) => {
		vscode.postMessage({
			type: "downloadMcp",
			mcpId,
		})
	}

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
						<div
							key={item.mcpId}
							style={{
								background: "var(--vscode-textCodeBlock-background)",
								borderRadius: "6px",
								overflow: "hidden",
							}}>
							{/* Header with logo */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "12px",
									borderBottom: "1px solid var(--vscode-widget-border)",
								}}>
								{item.logoUrl ? (
									<img
										src={item.logoUrl}
										alt={item.name}
										style={{
											width: 32,
											height: 32,
											borderRadius: "4px",
											marginRight: "12px",
										}}
									/>
								) : (
									<span
										className={`codicon codicon-${item.codiconIcon || "server"}`}
										style={{
											fontSize: "24px",
											marginRight: "12px",
											color: "var(--vscode-textLink-foreground)",
										}}
									/>
								)}
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 600, marginBottom: "4px" }}>{item.name}</div>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{t("mcp:marketplace.by", { author: item.author })}
									</div>
								</div>
							</div>

							{/* Description */}
							<div
								style={{
									padding: "12px",
									fontSize: "13px",
									color: "var(--vscode-foreground)",
									minHeight: "60px",
								}}>
								{item.description}
							</div>

							{/* Stats and Install */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "12px",
									borderTop: "1px solid var(--vscode-widget-border)",
									background: "var(--vscode-widget-shadow)",
								}}>
								<div
									style={{
										flex: 1,
										display: "flex",
										alignItems: "center",
										gap: "16px",
										fontSize: "12px",
										color: "var(--vscode-descriptionForeground)",
									}}>
									<div>
										<span className="codicon codicon-star-full" style={{ marginRight: "4px" }} />
										{item.githubStars}
									</div>
									<div>
										<span
											className="codicon codicon-cloud-download"
											style={{ marginRight: "4px" }}
										/>
										{item.downloadCount}
									</div>
								</div>
								<VSCodeButton onClick={() => handleInstall(item.mcpId)} style={{ minWidth: "80px" }}>
									{t("mcp:marketplace.install")}
								</VSCodeButton>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default McpMarketplaceView
