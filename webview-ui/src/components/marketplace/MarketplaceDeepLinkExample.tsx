import React from "react"
import { Button } from "@/components/ui/button"

/**
 * Example component demonstrating how to deep link to specific tabs in the MarketplaceView
 *
 * This component provides buttons that navigate directly to either the MCP or Mode tabs
 * within the Marketplace view.
 */
export function MarketplaceDeepLinkExample() {
	const openMcpMarketplace = () => {
		window.postMessage(
			{
				type: "action",
				action: "marketplaceButtonClicked",
				values: { marketplaceTab: "mcp" },
			},
			"*",
		)
	}

	const openModeMarketplace = () => {
		window.postMessage(
			{
				type: "action",
				action: "marketplaceButtonClicked",
				values: { marketplaceTab: "mode" },
			},
			"*",
		)
	}

	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-lg font-medium">Marketplace Deep Links</h3>
			<div className="flex gap-2">
				<Button onClick={openMcpMarketplace}>Open MCP Marketplace</Button>
				<Button onClick={openModeMarketplace}>Open Mode Marketplace</Button>
			</div>
		</div>
	)
}
