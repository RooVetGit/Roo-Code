import * as vscode from "vscode"

export const getClerkBaseUrl = () => process.env.CLERK_BASE_URL || "https://clerk.roocode.com"
export const getRooCodeApiUrl = () => process.env.ROO_CODE_API_URL || "https://app.roocode.com"

export const getDeepLinkUrl = (context: vscode.ExtensionContext) => {
	const ide = vscode.env.appName?.toLowerCase() ?? "vscode"
	const packageJSON = context.extension?.packageJSON
	const publisher = packageJSON?.publisher ?? "RooVeterinaryInc"
	const name = packageJSON?.name ?? "roo-cline"
	return `${ide}://${publisher}.${name}`
}
