import React from "react"
import { Button } from "@/components/ui/button"

/**
 * Test component for verifying the MarketplaceView deep linking functionality
 *
 * This component provides buttons that navigate directly to either the MCP or Mode tabs
 * within the Marketplace view, demonstrating the deep linking capability.
 */
export function MarketplaceDeepLinkTest() {
	// Function to open the MCP tab in the marketplace
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

	// Function to open the Mode tab in the marketplace
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
		<div className="flex flex-col gap-4 p-4 border border-vscode-panel-border rounded-md">
			<h2 className="text-xl font-bold">MarketplaceView Deep Linking Test</h2>
			<p className="text-vscode-descriptionForeground">
				Click the buttons below to test deep linking to specific tabs in the MarketplaceView.
			</p>
			<div className="flex gap-4">
				<Button onClick={openMcpMarketplace} variant="default">
					Open MCP Tab
				</Button>
				<Button onClick={openModeMarketplace} variant="secondary">
					Open Mode Tab
				</Button>
			</div>
		</div>
	)
}
