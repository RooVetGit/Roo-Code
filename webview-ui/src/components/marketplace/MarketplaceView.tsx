import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { MarketplaceItem } from "../../../../src/services/marketplace/types"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useStateManager } from "./useStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import InstallSidebar from "./InstallSidebar"
import { useEvent } from "react-use"
import { ExtensionMessage } from "@roo/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"
import { RocketConfig } from "config-rocket"
import { MarketplaceSourcesConfig } from "./MarketplaceSourcesConfigView"
import { MarketplaceListView } from "./MarketplaceListView"
import { cn } from "@/lib/utils"
import { Package, RefreshCw, Server } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"

interface MarketplaceViewProps {
	onDone?: () => void
	stateManager: MarketplaceViewStateManager
}
export function MarketplaceView({ stateManager }: MarketplaceViewProps) {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)

	const [tagSearch, setTagSearch] = useState("")
	const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false)
	const [showInstallSidebar, setShowInstallSidebar] = useState<
		| {
				item: MarketplaceItem
				config: RocketConfig
		  }
		| false
	>(false)

	const handleInstallSubmit = (item: MarketplaceItem, parameters: Record<string, any>) => {
		vscode.postMessage({
			type: "installMarketplaceItemWithParameters",
			payload: { item, parameters },
		})
		setShowInstallSidebar(false)
	}

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			if (message.type === "openMarketplaceInstallSidebarWithConfig") {
				setShowInstallSidebar({ item: message.payload.item, config: message.payload.config })
			}
		},
		[setShowInstallSidebar],
	)

	useEvent("message", onMessage)

	// Listen for panel visibility events to fetch data when panel becomes visible
	useEffect(() => {
		const handleVisibilityMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "webviewVisible" && message.visible === true) {
				// Fetch items when panel becomes visible and we're on browse tab
				if (state.activeTab === "browse" && !state.isFetching) {
					manager.transition({ type: "FETCH_ITEMS" })
				}
			}
		}

		window.addEventListener("message", handleVisibilityMessage)
		return () => window.removeEventListener("message", handleVisibilityMessage)
	}, [manager, state.activeTab, state.isFetching])

	// Fetch items on first mount or when returning to empty state
	useEffect(() => {
		if (!state.allItems.length && !state.isFetching) {
			manager.transition({ type: "FETCH_ITEMS" })
		}
	}, [manager, state.allItems.length, state.isFetching])

	// Memoize all available tags
	const allTags = useMemo(
		() => Array.from(new Set(state.allItems.flatMap((item) => item.tags || []))).sort(),
		[state.allItems],
	)

	// Memoize filtered tags
	const filteredTags = useMemo(
		() =>
			tagSearch ? allTags.filter((tag: string) => tag.toLowerCase().includes(tagSearch.toLowerCase())) : allTags,
		[allTags, tagSearch],
	)

	return (
		<TooltipProvider>
			<Tab>
				<TabHeader className="flex flex-col sticky top-0 z-10 px-3 py-2">
					<div className="flex justify-between items-center px-2">
						<h3 className="font-bold m-0">{t("marketplace:title")}</h3>
						<Button
							className={cn("h-4 px-0", {
								flex: state.activeTab === "browse",
								hidden: state.activeTab === "sources",
							})}
							variant="ghost"
							size="sm"
							onClick={() => manager.transition({ type: "FETCH_ITEMS" })}>
							<RefreshCw className={cn("size-4", state.isFetching && "animate-spin")} />
						</Button>
					</div>
					<div className="w-full mt-2">
						<div className="bg-vscode-input-background rounded-md flex relative py-1">
							<div
								className={cn(
									"absolute w-1/2 h-full top-0 rounded-sm bg-vscode-button-background transition-all duration-300 ease-in-out",
									{
										"left-0": state.activeTab === "browse",
										"left-1/2": state.activeTab === "sources",
									},
								)}
							/>
							<button
								className={cn(
									"flex items-center justify-center gap-2 flex-1 text-sm font-medium rounded-sm transition-colors duration-300 relative z-10",
									state.activeTab === "browse"
										? "text-vscode-button-foreground"
										: "text-vscode-foreground hover:text-vscode-button-background",
								)}
								onClick={() =>
									manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "browse" } })
								}>
								<Package className="h-4 w-4" />
								{t("marketplace:tabs.browse")}
							</button>
							<button
								className={cn(
									"flex items-center justify-center gap-2 flex-1 text-sm font-medium rounded-sm transition-colors duration-300 relative z-10",
									state.activeTab === "sources"
										? "text-vscode-button-foreground"
										: "text-vscode-foreground hover:text-vscode-button-background",
								)}
								onClick={() =>
									manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "sources" } })
								}>
								<Server className="h-4 w-4" />
								{t("marketplace:tabs.sources")}
							</button>
						</div>
					</div>
				</TabHeader>

				<TabContent className="p-3 pt-2 overflow-x-hidden">
					<div className="relative w-full h-full">
						<div
							className={cn("absolute w-full transition-all duration-300 ease-in-out", {
								"translate-x-0 opacity-100 z-10": state.activeTab === "browse",
								"translate-x-[-100%] opacity-0 z-0": state.activeTab === "sources",
							})}>
							<MarketplaceListView
								stateManager={stateManager}
								allTags={allTags}
								filteredTags={filteredTags}
								tagSearch={tagSearch}
								setTagSearch={setTagSearch}
								isTagPopoverOpen={isTagPopoverOpen}
								setIsTagPopoverOpen={setIsTagPopoverOpen}
							/>
						</div>

						<div
							className={cn("absolute w-full transition-all duration-300 ease-in-out", {
								"translate-x-0 opacity-100 z-10": state.activeTab === "sources",
								"translate-x-[100%] opacity-0 z-0": state.activeTab === "browse",
							})}>
							<MarketplaceSourcesConfig stateManager={stateManager} />
						</div>
					</div>
				</TabContent>
			</Tab>

			{showInstallSidebar && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
					<div className="animate-slide-in-right">
						<InstallSidebar
							onClose={() => setShowInstallSidebar(false)}
							onSubmit={handleInstallSubmit}
							item={showInstallSidebar.item}
							config={showInstallSidebar.config}
						/>
					</div>
				</div>
			)}
		</TooltipProvider>
	)
}
