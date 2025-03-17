import { useCallback, useState, useRef } from "react"
import styled from "styled-components"
import { McpMarketplaceItem, McpServer } from "../../../../../src/shared/mcp"
import { vscode } from "../../../utils/vscode"
import { useEvent } from "react-use"

interface McpMarketplaceCardProps {
	item: McpMarketplaceItem
	installedServers: McpServer[]
}

const McpMarketplaceCard = ({ item, installedServers }: McpMarketplaceCardProps) => {
	const isInstalled = installedServers.some((server) => server.name === item.mcpId)
	const [isDownloading, setIsDownloading] = useState(false)
	const githubLinkRef = useRef<HTMLDivElement>(null)

	const handleMessage = useCallback((event: MessageEvent) => {
		const message = event.data
		switch (message.type) {
			case "mcpDownloadDetails":
				setIsDownloading(false)
				break
		}
	}, [])

	useEvent("message", handleMessage)

	return (
		<>
			<style>
				{`
                    .mcp-card {
                        cursor: pointer;
                    }
                    .mcp-card:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                `}
			</style>
			<div
				className="mcp-card"
				onClick={(e) => {
					if (githubLinkRef.current?.contains(e.target as Node)) {
						return
					}

					vscode.postMessage({
						type: "openMcpMarketplaceServerDetails",
						mcpId: item.mcpId,
					})
				}}
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
							by {item.author}
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
							<span className="codicon codicon-cloud-download" style={{ marginRight: "4px" }} />
							{item.downloadCount}
						</div>
						<div ref={githubLinkRef}>
							<a
								href={item.githubUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								style={{
									color: "var(--vscode-textLink-foreground)",
									textDecoration: "none",
								}}>
								<span className="codicon codicon-github" style={{ marginRight: "4px" }} />
								GitHub
							</a>
						</div>
					</div>
					<div
						onClick={(e) => {
							e.stopPropagation() // Prevent card click when clicking install
							if (!isInstalled && !isDownloading) {
								setIsDownloading(true)
								vscode.postMessage({
									type: "downloadMcp",
									mcpId: item.mcpId,
								})
							}
						}}>
						<StyledInstallButton disabled={isInstalled || isDownloading} $isInstalled={isInstalled}>
							{isInstalled ? "Installed" : isDownloading ? "Installing..." : "Install"}
						</StyledInstallButton>
					</div>
				</div>
			</div>
		</>
	)
}

const StyledInstallButton = styled.div<{ disabled?: boolean; $isInstalled?: boolean }>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 2px;
	font-size: 13px;
	font-weight: 400;
	padding: 4px 12px;
	cursor: ${(props) => (props.disabled ? "default" : "pointer")};
	background: ${(props) =>
		props.$isInstalled ? "var(--vscode-button-secondaryBackground)" : "var(--vscode-button-background)"};
	color: var(--vscode-button-foreground);

	&:hover:not(:disabled) {
		background: ${(props) =>
			props.$isInstalled
				? "var(--vscode-button-secondaryHoverBackground)"
				: "var(--vscode-button-hoverBackground)"};
	}

	&:active:not(:disabled) {
		background: ${(props) =>
			props.$isInstalled ? "var(--vscode-button-secondaryBackground)" : "var(--vscode-button-background)"};
		opacity: 0.7;
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
`

export default McpMarketplaceCard
