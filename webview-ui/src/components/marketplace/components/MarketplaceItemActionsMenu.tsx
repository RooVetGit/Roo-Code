import React, { useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, ExternalLink, Download, Trash } from "lucide-react"
import {
	InstallMarketplaceItemOptions,
	MarketplaceItem,
	RemoveInstalledMarketplaceItemOptions,
} from "../../../../../src/services/marketplace/types"
import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ItemInstalledMetadata } from "@roo/services/marketplace/InstalledMetadataManager"

interface MarketplaceItemActionsMenuProps {
	item: MarketplaceItem
	installed: {
		project: ItemInstalledMetadata | undefined
		global: ItemInstalledMetadata | undefined
	}
	triggerNode?: React.ReactNode
}

export const MarketplaceItemActionsMenu: React.FC<MarketplaceItemActionsMenuProps> = ({
	item,
	installed,
	triggerNode,
}) => {
	const { t } = useAppTranslation()

	const itemSourceUrl = useMemo(() => {
		let url = item.repoUrl
		if (item.defaultBranch) {
			url = `${url}/tree/${item.defaultBranch}`
			if (item.path) {
				const normalizedPath = item.path.replace(/\\/g, "/").replace(/^\/+/, "")
				url = `${url}/${normalizedPath}`
			}
		}

		return url
	}, [item.repoUrl, item.defaultBranch, item.path])

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
			mpInstallOptions: options,
		})
	}

	const handleRemove = (options?: RemoveInstalledMarketplaceItemOptions) => {
		vscode.postMessage({
			type: "removeInstalledMarketplaceItem",
			mpItem: item,
			mpInstallOptions: options,
		})
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{triggerNode ?? (
					<Button
						className="px-2 w-4"
						variant="ghost"
						size="icon"
						aria-label={t("marketplace:items.card.actionsMenuLabel") || "Actions"}>
						<MoreVertical className="size-4" />
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="left">
				{/* View Source / External Link Item */}
				<DropdownMenuItem aria-label={item.sourceName} onClick={handleOpenSourceUrl}>
					<ExternalLink className="mr-1 size-3" />
					<span>{t("marketplace:items.card.viewSource")}</span>
				</DropdownMenuItem>

				{/* Remove (Global) */}
				{installed.global ? (
					<DropdownMenuItem onClick={() => handleRemove({ target: "global" })}>
						<Trash className="mr-1 size-3" />
						<span>{t("marketplace:items.card.removeGlobal")}</span>
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem onClick={() => handleInstall({ target: "global" })}>
						<Download className="mr-1 size-3" />
						<span>{t("marketplace:items.card.installGlobal")}</span>
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
