import React from "react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, ExternalLink, Download } from "lucide-react"
import { MarketplaceItem } from "../../../../../src/services/marketplace/types"
import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface MarketplaceItemActionsMenuProps {
	item: MarketplaceItem
	handleOpenSourceUrl: () => void
}

export const MarketplaceItemActionsMenu: React.FC<MarketplaceItemActionsMenuProps> = ({
	item,
	handleOpenSourceUrl,
}) => {
	const { t } = useAppTranslation()

	const handleInstall = () => {
		vscode.postMessage({
			type: "installMarketplaceItem",
			marketplaceItem: item
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

				{/* Install Item */}
				{showInstallButton && (
					<DropdownMenuItem onClick={handleInstall}>
						<Download className="mr-2 h-4 w-4" />
						<span>{t("marketplace:items.card.install")}</span>
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
