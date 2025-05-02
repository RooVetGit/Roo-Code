import React, { useMemo } from "react"
import { MarketplaceItem } from "../../../../../src/services/marketplace/types"
import { vscode } from "@/utils/vscode"
import { groupItemsByType, GroupedItems } from "../utils/grouping"
import { ExpandableSection } from "./ExpandableSection"
import { TypeGroup } from "./TypeGroup"
import { ViewState } from "../MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { MarketplaceItemActionsMenu } from "./MarketplaceItemActionsMenu"
import { isValidUrl } from "@roo/utils/url"

interface MarketplaceItemCardProps {
	item: MarketplaceItem
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	activeTab: ViewState["activeTab"]
	setActiveTab: (tab: ViewState["activeTab"]) => void
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
	item,
	filters,
	setFilters,
	activeTab,
	setActiveTab,
}) => {
	const { t } = useAppTranslation()

	const typeLabel = useMemo(() => {
		switch (item.type) {
			case "mode":
				return t("marketplace:filters.type.mode")
			case "mcp":
				return t("marketplace:filters.type.mcp")
			case "prompt":
				return t("marketplace:filters.type.prompt")
			case "package":
				return t("marketplace:filters.type.package")
			default:
				return "N/A"
		}
	}, [item.type, t])

	const typeColor = useMemo(() => {
		switch (item.type) {
			case "mode":
				return "bg-blue-600"
			case "mcp":
				return "bg-green-600"
			case "prompt":
				return "bg-purple-600"
			case "package":
				return "bg-orange-600"
			default:
				return "bg-gray-600"
		}
	}, [item.type])

	// Group items by type
	const groupedItems = useMemo(() => {
		if (!item.items?.length) {
			return null
		}
		return groupItemsByType(item.items)
	}, [item.items]) as GroupedItems | null

	return (
		<div className="border border-vscode-panel-border rounded-md p-4 bg-vscode-panel-background">
			<div className="flex justify-between items-start">
				<div>
					<h3 className="text-lg font-semibold text-vscode-foreground">{item.name}</h3>
					{item.authorUrl && isValidUrl(item.authorUrl) ? (
						<p className="text-sm text-vscode-descriptionForeground">
							{item.author ? (
								<button
									type="button"
									className="text-vscode-textLink hover:underline bg-transparent border-0 p-0 cursor-pointer"
									onClick={() => {
										vscode.postMessage({
											type: "openExternal",
											url: item.authorUrl,
										})
									}}>
									{t("marketplace:items.card.by", { author: item.author })}
								</button>
							) : (
								<button
									type="button"
									className="text-vscode-textLink hover:underline bg-transparent border-0 p-0 cursor-pointer"
									onClick={() => {
										vscode.postMessage({
											type: "openExternal",
											url: item.authorUrl,
										})
									}}>
									{t("marketplace:items.card.viewSource")}
								</button>
							)}
						</p>
					) : item.author ? (
						<p className="text-sm text-vscode-descriptionForeground">
							{t("marketplace:items.card.by", { author: item.author })}
						</p>
					) : null}
				</div>
				<span className={`px-2 py-1 text-xs text-white rounded-full ${typeColor}`}>{typeLabel}</span>
			</div>

			<p className="my-2 text-vscode-foreground">{item.description}</p>

			{item.tags && item.tags.length > 0 && (
				<div className="flex flex-wrap gap-1 my-2">
					{item.tags.map((tag) => (
						<button
							key={tag}
							className={`px-2 py-1 text-xs rounded-full hover:bg-vscode-button-secondaryBackground ${
								filters.tags.includes(tag)
									? "bg-vscode-button-background text-vscode-button-foreground"
									: "bg-vscode-badge-background text-vscode-badge-foreground"
							}`}
							onClick={() => {
								if (filters.tags.includes(tag)) {
									setFilters({
										tags: filters.tags.filter((t: string) => t !== tag),
									})
								} else {
									setFilters({
										tags: [...filters.tags, tag],
									})
									if (activeTab !== "browse") {
										setActiveTab("browse")
									}
								}
							}}
							title={
								filters.tags.includes(tag)
									? t("marketplace:filters.tags.clear", { count: tag })
									: t("marketplace:filters.tags.clickToFilter")
							}>
							{tag}
						</button>
					))}
				</div>
			)}

			<div className="flex justify-between items-center mt-4">
				<div className="flex items-center gap-4 text-sm text-vscode-descriptionForeground">
					{item.version && (
						<span className="flex items-center">
							<span className="codicon codicon-tag mr-1"></span>
							{item.version}
						</span>
					)}
					{item.lastUpdated && (
						<span className="flex items-center">
							<span className="codicon codicon-calendar mr-1"></span>
							{new Date(item.lastUpdated).toLocaleDateString(undefined, {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}
						</span>
					)}
				</div>

				<MarketplaceItemActionsMenu item={item} />
			</div>

			{item.type === "package" && (
				<div className="border-t border-vscode-panel-border mt-4">
					<ExpandableSection
						title={t("marketplace:items.components", { count: item.items?.length ?? 0 })}
						badge={(() => {
							const matchCount = item.items?.filter((subItem) => subItem.matchInfo?.matched).length ?? 0
							return matchCount > 0 ? t("marketplace:items.components", { count: matchCount }) : undefined
						})()}
						defaultExpanded={item.items?.some((subItem) => subItem.matchInfo?.matched) ?? false}>
						<div className="space-y-4">
							{groupedItems &&
								Object.entries(groupedItems).map(([type, group]) => (
									<TypeGroup key={type} type={type} items={group.items} />
								))}
						</div>
					</ExpandableSection>
				</div>
			)}
		</div>
	)
}
