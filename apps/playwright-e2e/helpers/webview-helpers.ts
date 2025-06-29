import { type Page, type FrameLocator, expect } from "@playwright/test"
import type { WebviewMessage } from "../../../src/shared/WebviewMessage"
import { ProviderSettings } from "../../../packages/types/dist/index.cjs"

const defaultPlaywrightApiConfig = {
	apiProvider: "openrouter" as const,
	openRouterApiKey: process.env.OPENROUTER_API_KEY,
	openRouterModelId: "openai/gpt-4o-mini",
}

export async function findWebview(workbox: Page): Promise<FrameLocator> {
	const webviewFrameEl = workbox.frameLocator(
		'iframe[src*="extensionId=RooVeterinaryInc.roo-cline"][src*="purpose=webviewView"]',
	)
	await webviewFrameEl.locator("#active-frame").waitFor()
	return webviewFrameEl.frameLocator("#active-frame")
}

export async function waitForWebviewText(page: Page, text: string, timeout: number = 30000): Promise<void> {
	const webviewFrame = await findWebview(page)
	await expect(webviewFrame.locator("body")).toContainText(text, { timeout })
}

export async function postWebviewMessage(page: Page, message: WebviewMessage): Promise<void> {
	const webviewFrame = await findWebview(page)
	await webviewFrame.locator("body").evaluate((element, msg) => {
		if (!window.vscode) {
			throw new Error("Global vscode API not found")
		}

		window.vscode.postMessage(msg)
	}, message)
}

export async function verifyExtensionInstalled(page: Page) {
	try {
		const activityBarIcon = page.locator('[aria-label*="Roo"]').first()
		expect(await activityBarIcon).toBeDefined()
		activityBarIcon.click()
	} catch (_error) {
		throw new Error("Failed to find the installed extension! Check if the build failed and try again.")
	}
}

export async function upsertApiConfiguration(page: Page, apiConfiguration?: Partial<ProviderSettings>): Promise<void> {
	await postWebviewMessage(page, {
		type: "upsertApiConfiguration",
		text: "default",
		apiConfiguration: apiConfiguration ?? defaultPlaywrightApiConfig,
	})
	await postWebviewMessage(page, { type: "currentApiConfigName", text: "default" })
}
