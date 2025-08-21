import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useRequestyKeyInfo } from "@/components/ui/hooks/useRequestyKeyInfo"

export const RequestyBalanceDisplay = ({ apiKey, baseUrl }: { apiKey: string; baseUrl?: string }) => {
	const { data: keyInfo } = useRequestyKeyInfo(apiKey, baseUrl)

	if (!keyInfo) {
		return null
	}

	// Parse the balance to a number and format it to 2 decimal places.
	const balance = parseFloat(keyInfo.org_balance)
	const formattedBalance = balance.toFixed(2)

	// Use the base URL if provided, otherwise default to the standard app URL
	const settingsUrl = (() => {
		const appUrl = baseUrl || "https://app.requesty.ai"
		// Remove trailing slash if present and ensure we're using the app subdomain
		const cleanUrl = appUrl.replace(/\/$/, "")
		// If the base URL contains 'router' or 'api', replace with 'app' for web interface
		const webUrl = cleanUrl.replace(/router\.requesty/, "app.requesty").replace(/api\.requesty/, "app.requesty")
		return `${webUrl}/settings`
	})()

	return (
		<VSCodeLink href={settingsUrl} className="text-vscode-foreground hover:underline">
			${formattedBalance}
		</VSCodeLink>
	)
}
