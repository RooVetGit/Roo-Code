import React, { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { PackageManagerItem } from "../../../../../src/services/package-manager/types"
import { vscode } from "@/utils/vscode"
import { groupItemsByType, GroupedItems } from "../utils/grouping"
import { ExpandableSection } from "./ExpandableSection"
import { TypeGroup } from "./TypeGroup"

interface PackageManagerItemCardProps {
	item: PackageManagerItem
	filters: { type: string; search: string; tags: string[] }
	setFilters: React.Dispatch<React.SetStateAction<{ type: string; search: string; tags: string[] }>>
	activeTab: "browse" | "sources"
	setActiveTab: React.Dispatch<React.SetStateAction<"browse" | "sources">>
}

export const PackageManagerItemCard: React.FC<PackageManagerItemCardProps> = ({
	item,
	filters,
	setFilters,
	activeTab,
	setActiveTab,
}) => {
	const isValidUrl = (urlString: string): boolean => {
		try {
			new URL(urlString)
			return true
		} catch (e) {
			return false
		}
	}

	const getTypeLabel = (type: string) => {
		switch (type) {
			case "mode":
				return "Mode"
			case "mcp server":
				return "MCP Server"
			case "prompt":
				return "Prompt"
			case "package":
				return "Package"
			default:
				return "Other"
		}
	}

	const getTypeColor = (type: string) => {
		switch (type) {
			case "mode":
				return "bg-blue-600"
			case "mcp server":
				return "bg-green-600"
			case "prompt":
				return "bg-purple-600"
			case "package":
				return "bg-orange-600"
			default:
				return "bg-gray-600"
		}
	}

	const handleOpenUrl = () => {
		const urlToOpen = item.sourceUrl && isValidUrl(item.sourceUrl) ? item.sourceUrl : item.repoUrl
		vscode.postMessage({
			type: "openExternal",
			url: urlToOpen,
		})
	}

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
					{item.author && <p className="text-sm text-vscode-descriptionForeground">{`by ${item.author}`}</p>}
				</div>
				<span className={`px-2 py-1 text-xs text-white rounded-full ${getTypeColor(item.type)}`}>
					{getTypeLabel(item.type)}
				</span>
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
										...filters,
										tags: filters.tags.filter((t) => t !== tag),
									})
								} else {
									setFilters({
										...filters,
										tags: [...filters.tags, tag],
									})
									if (activeTab !== "browse") {
										setActiveTab("browse")
									}
								}
							}}
							title={filters.tags.includes(tag) ? `Remove tag filter: ${tag}` : `Filter by tag: ${tag}`}>
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

				<Button onClick={handleOpenUrl}>
					<span className="codicon codicon-link-external mr-2"></span>
					{item.sourceUrl ? "View" : item.sourceName || "Source"}
				</Button>
			</div>

			{groupedItems && (
				<ExpandableSection title="Details">
					{Object.entries(groupedItems).map(([type, group]) => (
						<TypeGroup key={type} type={type} items={group.items} />
					))}
				</ExpandableSection>
			)}
		</div>
	)
}
