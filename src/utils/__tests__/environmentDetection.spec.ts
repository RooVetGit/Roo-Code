import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { isCodeServerEnvironment, getEnvironmentInfo, shouldUseAlternativeAuth } from "../environmentDetection"

// Mock vscode module
vi.mock("vscode", () => ({
	env: {
		uiKind: 1, // Default to Desktop
		appName: "Visual Studio Code",
		remoteName: undefined,
	},
	UIKind: {
		Desktop: 1,
		Web: 2,
	},
}))

describe("environmentDetection", () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env }
		// Clear relevant environment variables
		delete process.env.CODE_SERVER_VERSION
		delete process.env.DOCKER_CONTAINER
		delete process.env.KUBERNETES_SERVICE_HOST
		delete process.env.COOLIFY_CONTAINER_NAME
		delete process.env.COOLIFY_APP_ID
		// Reset vscode mock to default values
		vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
		vi.mocked(vscode.env).appName = "Visual Studio Code"
		vi.mocked(vscode.env).remoteName = undefined
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe("isCodeServerEnvironment", () => {
		it("should return true when CODE_SERVER_VERSION is set", () => {
			process.env.CODE_SERVER_VERSION = "4.0.0"
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return true when running in Web UI", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Web
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return false when running in Desktop UI", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
			expect(isCodeServerEnvironment()).toBe(false)
		})

		it("should return true when app name contains code-server", () => {
			vi.mocked(vscode.env).appName = "Code-Server"
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return true when app name contains code server (with space)", () => {
			vi.mocked(vscode.env).appName = "Code Server"
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return true when DOCKER_CONTAINER is set and UI is Web", () => {
			process.env.DOCKER_CONTAINER = "true"
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Web
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return false when DOCKER_CONTAINER is set but UI is Desktop", () => {
			process.env.DOCKER_CONTAINER = "true"
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
			expect(isCodeServerEnvironment()).toBe(false)
		})

		it("should return true when KUBERNETES_SERVICE_HOST is set and UI is Web", () => {
			process.env.KUBERNETES_SERVICE_HOST = "10.0.0.1"
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Web
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return true when COOLIFY_CONTAINER_NAME is set", () => {
			process.env.COOLIFY_CONTAINER_NAME = "my-app"
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return true when COOLIFY_APP_ID is set", () => {
			process.env.COOLIFY_APP_ID = "app-123"
			expect(isCodeServerEnvironment()).toBe(true)
		})

		it("should return false in regular desktop VS Code", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
			vi.mocked(vscode.env).appName = "Visual Studio Code"
			expect(isCodeServerEnvironment()).toBe(false)
		})
	})

	describe("getEnvironmentInfo", () => {
		it("should return correct environment info for desktop VS Code", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
			vi.mocked(vscode.env).appName = "Visual Studio Code"
			vi.mocked(vscode.env).remoteName = undefined

			const info = getEnvironmentInfo()
			expect(info).toEqual({
				isCodeServer: false,
				uiKind: "Desktop",
				appName: "Visual Studio Code",
				isRemote: false,
			})
		})

		it("should return correct environment info for Code-Server", () => {
			process.env.CODE_SERVER_VERSION = "4.0.0"
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Web
			vi.mocked(vscode.env).appName = "Code-Server"
			vi.mocked(vscode.env).remoteName = "ssh-remote"

			const info = getEnvironmentInfo()
			expect(info).toEqual({
				isCodeServer: true,
				uiKind: "Web",
				appName: "Code-Server",
				isRemote: true,
			})
		})

		it("should detect remote environment correctly", () => {
			vi.mocked(vscode.env).remoteName = "wsl"
			const info = getEnvironmentInfo()
			expect(info.isRemote).toBe(true)
		})
	})

	describe("shouldUseAlternativeAuth", () => {
		it("should return true when in Code-Server environment", () => {
			process.env.CODE_SERVER_VERSION = "4.0.0"
			expect(shouldUseAlternativeAuth()).toBe(true)
		})

		it("should return false when in desktop VS Code", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Desktop
			expect(shouldUseAlternativeAuth()).toBe(false)
		})

		it("should return true when UI is Web", () => {
			vi.mocked(vscode.env).uiKind = vscode.UIKind.Web
			expect(shouldUseAlternativeAuth()).toBe(true)
		})
	})
})
