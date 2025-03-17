import { useEffect, useState, useMemo } from "react"
import {
	VSCodeButton,
	VSCodeProgressRing,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "../../../i18n/TranslationContext"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"
import { McpMarketplaceItem } from "../../../../../src/shared/mcp"
import McpMarketplaceCard from "./McpMarketplaceCard"
import McpSubmitCard from "./McpSubmitCard"

type SortOption = "stars" | "downloads" | "newest" | "updated"

const McpMarketplaceView = () => {
	const { t } = useAppTranslation()
	const { mcpServers } = useExtensionState()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [items, setItems] = useState<McpMarketplaceItem[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedCategory, setSelectedCategory] = useState<string>("all")
	const [sortBy, setSortBy] = useState<SortOption>("stars")

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
		vscode.postMessage({ type: "fetchMcpMarketplace" })
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const categories = useMemo(() => {
		const categorySet = new Set(items.map((item) => item.category))
		return ["all", ...Array.from(categorySet)]
	}, [items])

	const filteredAndSortedItems = useMemo(() => {
		let filtered = items

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(
				(item) =>
					item.name.toLowerCase().includes(query) ||
					item.description.toLowerCase().includes(query) ||
					item.tags.some((tag) => tag.toLowerCase().includes(query)),
			)
		}

		// Apply category filter
		if (selectedCategory !== "all") {
			filtered = filtered.filter((item) => item.category === selectedCategory)
		}

		// Apply sorting
		return [...filtered].sort((a, b) => {
			switch (sortBy) {
				case "stars":
					return b.githubStars - a.githubStars
				case "downloads":
					return b.downloadCount - a.downloadCount
				case "newest":
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				case "updated":
					return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				default:
					return 0
			}
		})
	}, [items, searchQuery, selectedCategory, sortBy])

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
			<div style={{ padding: "16px 0", display: "flex", gap: "16px", alignItems: "center" }}>
				<VSCodeTextField
					placeholder={t("mcp:marketplace.searchPlaceholder")}
					value={searchQuery}
					onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
					style={{ flexGrow: 1 }}
				/>
				<VSCodeDropdown
					value={selectedCategory}
					onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}>
					{categories.map((category) => (
						<VSCodeOption key={category} value={category}>
							{category === "all" ? t("mcp:marketplace.allCategories") : category}
						</VSCodeOption>
					))}
				</VSCodeDropdown>
				<VSCodeDropdown
					value={sortBy}
					onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortOption)}>
					<VSCodeOption value="stars">{t("mcp:marketplace.sortByStars")}</VSCodeOption>
					<VSCodeOption value="downloads">{t("mcp:marketplace.sortByDownloads")}</VSCodeOption>
					<VSCodeOption value="newest">{t("mcp:marketplace.sortByNewest")}</VSCodeOption>
					<VSCodeOption value="updated">{t("mcp:marketplace.sortByUpdated")}</VSCodeOption>
				</VSCodeDropdown>
			</div>

			{filteredAndSortedItems.length === 0 ? (
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
					<p style={{ margin: 0 }}>
						{searchQuery || selectedCategory !== "all"
							? t("mcp:marketplace.noResults")
							: t("mcp:marketplace.noServers")}
					</p>
				</div>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						gap: "16px",
						padding: "16px 0",
					}}>
					{filteredAndSortedItems.map((item) => (
						<McpMarketplaceCard key={item.mcpId} item={item} installedServers={mcpServers} />
					))}
					<McpSubmitCard />
				</div>
			)}
		</div>
	)
}

export default McpMarketplaceView
