import React, { useMemo } from "react"
import { MarketplaceItem } from "@roo/services/marketplace/types" // Updated import path
import { vscode } from "@/utils/vscode"
import { groupItemsByType, GroupedItems } from "../utils/grouping"
import { ExpandableSection } from "./ExpandableSection"
import { TypeGroup } from "./TypeGroup"
import { ViewState } from "../MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { MarketplaceItemActionsMenu } from "./MarketplaceItemActionsMenu"
import { isValidUrl } from "@roo/utils/url"
import { ItemInstalledMetadata } from "@roo/services/marketplace/InstalledMetadataManager"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Rocket, Server, Package, Sparkles, ChevronDown } from "lucide-react"

interface MarketplaceItemCardProps {
	item: MarketplaceItem
	installed: {
		project: ItemInstalledMetadata | undefined
		global: ItemInstalledMetadata | undefined
	}
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	activeTab: ViewState["activeTab"]
	setActiveTab: (tab: ViewState["activeTab"]) => void
}

const icons = {
	mode: <Rocket className="size-3" />,
	mcp: <Server className="size-3" />,
	package: <Package className="size-3" />,
	prompt: <Sparkles className="size-3" />,
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
	item,
	installed,
	filters,
	setFilters,
	activeTab,
	setActiveTab,
}) => {
	const { t } = useAppTranslation()

	const typeLabel = useMemo(() => {
		const labels: Partial<Record<MarketplaceItem["type"], string>> = {
			mode: t("marketplace:filters.type.mode"),
			mcp: t("marketplace:filters.type.mcp server"),
			prompt: t("marketplace:filters.type.prompt"),
			package: t("marketplace:filters.type.package"),
		}
		return labels[item.type] ?? "N/A"
	}, [item.type, t])

	const groupedItems = useMemo(() => {
		if (!item.items?.length) return null
		return groupItemsByType(item.items)
	}, [item.items]) as GroupedItems | null

	const expandableSectionBadge = useMemo(() => {
		const matchCount = item.items?.filter((subItem) => subItem.matchInfo?.matched).length ?? 0
		return matchCount > 0 ? t("marketplace:items.components", { count: matchCount }) : undefined
	}, [item.items, t])

	return (
		<div className="border border-vscode-panel-border rounded-sm p-3 bg-vscode-editor-background">
			<div className="flex gap-2 items-start">
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className={cn(
								"p-2 text-xs rounded-sm flex gap-1 items-center bg-primary text-vscode-button-foreground",
							)}>
							{icons[item.type]}
						</span>
					</TooltipTrigger>
					<TooltipContent>{typeLabel}</TooltipContent>
				</Tooltip>
				<div>
					<h3 className="text-lg font-semibold text-vscode-foreground mt-0 mb-1 leading-none">{item.name}</h3>
					<AuthorInfo item={item} typeLabel={typeLabel} />
				</div>
			</div>

			<p className="my-2 text-vscode-foreground">{item.description}</p>

			{item.tags && item.tags.length > 0 && (
				<div className="relative flex gap-1 my-2 overflow-x-auto scrollbar-hide">
					{item.tags.map((tag) => (
						<Button
							key={tag}
							size="sm"
							variant={filters.tags.includes(tag) ? "default" : "secondary"}
							className="rounded-sm capitalize text-xs px-2 h-5 border-dashed"
							onClick={() => {
								const newTags = filters.tags.includes(tag)
									? filters.tags.filter((t: string) => t !== tag)
									: [...filters.tags, tag]
								setFilters({ tags: newTags })

								if (!filters.tags.includes(tag) && activeTab !== "browse") {
									setActiveTab("browse")
								}
							}}
							title={
								filters.tags.includes(tag)
									? t("marketplace:filters.tags.clear", { count: tag })
									: t("marketplace:filters.tags.clickToFilter")
							}>
							{tag}
						</Button>
					))}
				</div>
			)}

			<div className="flex justify-between items-center">
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

				<div className="flex items-center">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="sm"
								variant="default"
								className="text-xs h-5 rounded-r-none py-0 px-2"
								onClick={() =>
									vscode.postMessage({
										type: installed.project
											? "removeInstalledMarketplaceItem"
											: "installMarketplaceItem",
										mpItem: item,
										mpInstallOptions: { target: "project" },
									})
								}>
								{installed.project
									? t("marketplace:items.card.removeProject")
									: t("marketplace:items.card.installProject")}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{installed.project
								? t("marketplace:items.card.removeProject")
								: t("marketplace:items.card.installProject")}
						</TooltipContent>
					</Tooltip>
					<MarketplaceItemActionsMenu
						item={item}
						installed={installed}
						triggerNode={
							<Button
								size="sm"
								variant="default"
								className="h-5 px-1 py-0 rounded-l-none border-l border-l-white/10">
								<ChevronDown className="size-3" />
							</Button>
						}
					/>
				</div>
			</div>

			{item.type === "package" && (
				<ExpandableSection
					title={t("marketplace:items.components", { count: item.items?.length ?? 0 })}
					badge={expandableSectionBadge}
					defaultExpanded={item.items?.some((subItem) => subItem.matchInfo?.matched) ?? false}>
					<div className="space-y-4">
						{groupedItems &&
							Object.entries(groupedItems).map(([type, group]) => (
								<TypeGroup key={type} type={type} items={group.items} />
							))}
					</div>
				</ExpandableSection>
			)}
		</div>
	)
}

interface AuthorInfoProps {
	item: MarketplaceItem
	typeLabel: string
}

const AuthorInfo: React.FC<AuthorInfoProps> = ({ item, typeLabel }) => {
	const { t } = useAppTranslation()

	const handleOpenAuthorUrl = () => {
		if (item.authorUrl && isValidUrl(item.authorUrl)) {
			vscode.postMessage({ type: "openExternal", url: item.authorUrl })
		}
	}

	if (item.author) {
		return (
			<p className="text-sm text-vscode-descriptionForeground my-0">
				{typeLabel}{" "}
				{item.authorUrl && isValidUrl(item.authorUrl) ? (
					<Button
						variant="link"
						className="p-0 h-auto text-sm text-vscode-textLink hover:underline"
						onClick={handleOpenAuthorUrl}>
						{t("marketplace:items.card.by", { author: item.author })}
					</Button>
				) : (
					t("marketplace:items.card.by", { author: item.author })
				)}
			</p>
		)
	}
	return null
}
