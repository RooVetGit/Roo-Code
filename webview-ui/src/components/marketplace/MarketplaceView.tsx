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
import type { RocketConfig } from "config-rocket"
import { MarketplaceSourcesConfig } from "./MarketplaceSourcesConfigView"
import { MarketplaceListView } from "./MarketplaceListView"
import { cn } from "@/lib/utils"
import { RefreshCw } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"

interface MarketplaceViewProps {
	onDone?: () => void
	stateManager: MarketplaceViewStateManager
}
export function MarketplaceView({ stateManager, onDone }: MarketplaceViewProps) {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)

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
	const filteredTags = useMemo(() => allTags, [allTags])

	return (
		<TooltipProvider>
			<Tab>
				<TabHeader className="flex flex-col sticky top-0 z-10 px-3 py-2">
					<div className="flex justify-between items-center px-2">
						<h3 className="font-bold m-0">{t("marketplace:title")}</h3>
						<div className="flex gap-2 items-center">
							<Button variant="secondary" onClick={() => manager.transition({ type: "FETCH_ITEMS" })}>
								<RefreshCw className={cn("size-4", { "animate-spin": state.isFetching })} />
								{t("marketplace:refresh")}
							</Button>
							<Button
								variant="default"
								onClick={() => {
									if (state.activeTab === "browse" || state.activeTab === "installed") {
										onDone?.()
									} else {
										manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "browse" } })
									}
								}}>
								{t("marketplace:done")}
							</Button>
						</div>
					</div>

					<div className="w-full mt-2">
						<div className="flex relative py-1">
							<div className="absolute w-full h-[2px] -bottom-[2px] bg-vscode-input-border">
								<div
									className={cn(
										"absolute w-1/3 h-[2px] bottom-0 bg-vscode-button-background transition-all duration-300 ease-in-out",
										{
											"left-0": state.activeTab === "browse",
											"left-1/3": state.activeTab === "installed",
											"left-2/3": state.activeTab === "settings",
										},
									)}
								/>
							</div>
							<button
								className="flex items-center justify-center gap-2 flex-1 text-sm font-medium rounded-sm transition-colors duration-300 relative z-10 text-vscode-foreground"
								onClick={() =>
									manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "browse" } })
								}>
								{t("marketplace:tabs.browse")}
							</button>
							<button
								className="flex items-center justify-center gap-2 flex-1 text-sm font-medium rounded-sm transition-colors duration-300 relative z-10 text-vscode-foreground"
								onClick={() =>
									manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "installed" } })
								}>
								{t("marketplace:tabs.installed")}
							</button>
							<button
								className="flex items-center justify-center gap-2 flex-1 text-sm font-medium rounded-sm transition-colors duration-300 relative z-10 text-vscode-foreground"
								onClick={() =>
									manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "settings" } })
								}>
								{t("marketplace:tabs.settings")}
							</button>
						</div>
					</div>
				</TabHeader>

				<TabContent className="p-3 pt-2 overflow-x-hidden">
					<div className="relative w-full h-full">
						<div
							className={cn("absolute w-full transition-all duration-300 ease-in-out", {
								"translate-x-0 opacity-100 z-10": state.activeTab === "browse",
								"translate-x-[-100%] opacity-0 invisible z-0": state.activeTab === "installed",
								"translate-x-[-200%] opacity-0 invisible z-0": state.activeTab === "settings",
							})}>
							<MarketplaceListView
								stateManager={stateManager}
								allTags={allTags}
								filteredTags={filteredTags}
							/>
						</div>

						<div
							className={cn("absolute w-full transition-all duration-300 ease-in-out", {
								"translate-x-[100%] opacity-0 invisible z-0": state.activeTab === "browse",
								"translate-x-0 opacity-100 z-10": state.activeTab === "installed",
								"translate-x-[-100%] opacity-0 invisible z-0": state.activeTab === "settings",
							})}>
							<MarketplaceListView
								stateManager={stateManager}
								allTags={allTags}
								filteredTags={filteredTags}
								showInstalledOnly={true}
							/>
						</div>

						<div
							className={cn("absolute w-full transition-all duration-300 ease-in-out", {
								"translate-x-[200%] opacity-0 invisible z-0": state.activeTab === "browse",
								"translate-x-[100%] opacity-0 invisible z-0": state.activeTab === "installed",
								"translate-x-0 opacity-100 z-10": state.activeTab === "settings",
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
