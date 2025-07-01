import { defineConfig } from "@playwright/test"
import { TestOptions } from "./tests/playwright-base-test"
import * as dotenv from "dotenv"
import * as path from "path"

const envPath = path.resolve(__dirname, ".env")
dotenv.config({ path: envPath })

export default defineConfig<void, TestOptions>({
	reporter: process.env.CI ? "html" : "list",
	timeout: 120_000,
	workers: 1,
	expect: {
		timeout: 30_000,
	},
	globalSetup: "./playwright.globalSetup",
	testDir: "./tests",
	testIgnore: "**/helpers/__tests__/**",
	outputDir: "./test-results",
	projects: [
		// { name: "VSCode insiders", use: { vscodeVersion: "insiders" } },
		{ name: "VSCode stable", use: { vscodeVersion: "stable" } },
	],
	use: {
		// Keep headless true for Playwright, but don't pass --headless to VS Code
		headless: true,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		// Add longer timeouts for CI environment
		...(process.env.CI && {
			actionTimeout: 60_000,
			navigationTimeout: 60_000,
		}),
	},
})
