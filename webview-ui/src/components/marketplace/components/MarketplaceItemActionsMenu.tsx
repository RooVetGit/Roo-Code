import React, { useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, ExternalLink, Download } from "lucide-react"
import { InstallMarketplaceItemOptions, MarketplaceItem } from "../../../../../src/services/marketplace/types"
import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { isValidUrl } from "@roo/utils/url"

interface MarketplaceItemActionsMenuProps {
	item: MarketplaceItem
}

export const MarketplaceItemActionsMenu: React.FC<MarketplaceItemActionsMenuProps> = ({
	item,
}) => {
	const { t } = useAppTranslation()

	const itemSourceUrl = useMemo(() => {
		if (item.sourceUrl && isValidUrl(item.sourceUrl)) {
			return item.sourceUrl
		}

		let url = item.repoUrl
		if (item.defaultBranch) {
			url = `${url}/tree/${item.defaultBranch}`
			if (item.path) {
				const normalizedPath = item.path.replace(/\\/g, "/").replace(/^\/+/, "")
				url = `${url}/${normalizedPath}`
			}
		}
		return url
	}, [item.sourceUrl, item.repoUrl, item.defaultBranch, item.path])

	const handleOpenSourceUrl = useCallback(() => {
		vscode.postMessage({
			type: "openExternal",
			url: itemSourceUrl,
		})
	}, [itemSourceUrl])

	const handleInstall = (options?: InstallMarketplaceItemOptions) => {
		vscode.postMessage({
			type: "installMarketplaceItem",
			mpItem: item,
			mpInstallOptions: options
		})
	}

	// Don't show for `package` items for now
	const showInstallButton = item.type !== "package" // Don't show for package containers

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={t("marketplace:items.card.actionsMenuLabel") || "Actions"}>
					<MoreVertical className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="bottom">
				{/* View Source / External Link Item */}
				<DropdownMenuItem
					aria-label={item.sourceName}
					onClick={handleOpenSourceUrl}
				>
					<ExternalLink className="mr-2 h-4 w-4" />
					<span>{t("marketplace:items.card.viewSource")}</span>
				</DropdownMenuItem>

				{/* Install (Project) */}
				{showInstallButton && (
					<DropdownMenuItem onClick={() => handleInstall({target: 'project'})}>
						<Download className="mr-2 h-4 w-4" />
						<span>{t("marketplace:items.card.installProject")}</span>
					</DropdownMenuItem>
				)}

				{/* Install (Global) */}
				{showInstallButton && (
					<DropdownMenuItem onClick={() => handleInstall({target: 'global'})}>
						<Download className="mr-2 h-4 w-4" />
						<span>{t("marketplace:items.card.installGlobal")}</span>
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
