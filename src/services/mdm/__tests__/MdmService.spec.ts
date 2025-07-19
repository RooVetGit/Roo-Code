import * as path from "path"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock dependencies before importing the module under test
vi.mock("fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

vi.mock("../../../utils/safeReadJson", () => ({
	safeReadJson: vi.fn(),
}))

vi.mock("os", () => ({
	platform: vi.fn(),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn(),
		instance: {
			hasOrIsAcquiringActiveSession: vi.fn(),
			getOrganizationId: vi.fn(),
			getStoredOrganizationId: vi.fn(),
		},
	},
	getClerkBaseUrl: vi.fn(),
	PRODUCTION_CLERK_BASE_URL: "https://clerk.roocode.com",
}))

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

vi.mock("../../../shared/package", () => ({
	Package: {
		publisher: "roo-code",
		name: "roo-cline",
		version: "1.0.0",
		outputChannel: "Roo-Code",
		sha: undefined,
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => {
		const translations: Record<string, string> = {
			"mdm.errors.cloud_auth_required":
				"Your organization requires Roo Code Cloud authentication. Please sign in to continue.",
			"mdm.errors.organization_mismatch":
				"You must be authenticated with your organization's Roo Code Cloud account.",
			"mdm.errors.verification_failed": "Unable to verify organization authentication.",
		}
		return translations[key] || key
	}),
}))

// Now import the module under test and mocked modules
import { MdmService } from "../MdmService"
import { CloudService, getClerkBaseUrl, PRODUCTION_CLERK_BASE_URL } from "@roo-code/cloud"
import * as fs from "fs"
import * as os from "os"
import * as vscode from "vscode"
import { safeReadJson } from "../../../utils/safeReadJson"

describe("MdmService", () => {
	let originalPlatform: string

	beforeEach(() => {
		// Reset singleton
		MdmService.resetInstance()

		// Store original platform
		originalPlatform = process.platform

		// Set default platform for tests
		vi.mocked(os.platform).mockReturnValue("darwin")

		// Setup default mock for getClerkBaseUrl to return development URL
		vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

		// Setup VSCode mocks
		const mockConfig = {
			get: vi.fn().mockReturnValue(false),
			update: vi.fn().mockResolvedValue(undefined),
		}
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

		// Reset mocks
		vi.clearAllMocks()

		// Re-setup the default after clearing
		vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

		// Reset safeReadJson to reject with ENOENT by default (no MDM config)
		vi.mocked(safeReadJson).mockClear()
		vi.mocked(safeReadJson).mockRejectedValue({ code: "ENOENT" })

		// Reset MdmService instance before each test
		MdmService.resetInstance()
	})

	afterEach(() => {
		// Restore original platform
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
		})
	})

	describe("initialization", () => {
		it("should create instance successfully", async () => {
			// Default mock setup is fine (ENOENT)

			const service = await MdmService.createInstance()
			expect(service).toBeInstanceOf(MdmService)
		})

		it("should load MDM config if file exists", async () => {
			const mockConfig = {
				requireCloudAuth: true,
				organizationId: "test-org-123",
			}

			// Important: Use mockResolvedValueOnce instead of mockResolvedValue
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			const service = await MdmService.createInstance()

			expect(service.requiresCloudAuth()).toBe(true)
			expect(service.getRequiredOrganizationId()).toBe("test-org-123")
		})

		it("should handle missing MDM config file gracefully", async () => {
			// Default mock setup is fine (ENOENT)

			const service = await MdmService.createInstance()

			expect(service.requiresCloudAuth()).toBe(false)
			expect(service.getRequiredOrganizationId()).toBeUndefined()
		})

		it("should handle invalid JSON gracefully", async () => {
			// Mock safeReadJson to throw a parsing error
			vi.mocked(safeReadJson).mockRejectedValueOnce(new Error("Invalid JSON"))

			const service = await MdmService.createInstance()

			expect(service.requiresCloudAuth()).toBe(false)
		})
	})

	describe("platform-specific config paths", () => {
		let originalNodeEnv: string | undefined

		beforeEach(() => {
			originalNodeEnv = process.env.NODE_ENV
		})

		afterEach(() => {
			if (originalNodeEnv !== undefined) {
				process.env.NODE_ENV = originalNodeEnv
			} else {
				delete process.env.NODE_ENV
			}
		})

		it("should use correct path for Windows in production", async () => {
			vi.mocked(os.platform).mockReturnValue("win32")
			process.env.PROGRAMDATA = "C:\\ProgramData"
			vi.mocked(getClerkBaseUrl).mockReturnValue(PRODUCTION_CLERK_BASE_URL)

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith(path.join("C:\\ProgramData", "RooCode", "mdm.json"))
		})

		it("should use correct path for Windows in development", async () => {
			vi.mocked(os.platform).mockReturnValue("win32")
			process.env.PROGRAMDATA = "C:\\ProgramData"
			vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith(path.join("C:\\ProgramData", "RooCode", "mdm.dev.json"))
		})

		it("should use correct path for macOS in production", async () => {
			vi.mocked(os.platform).mockReturnValue("darwin")
			vi.mocked(getClerkBaseUrl).mockReturnValue(PRODUCTION_CLERK_BASE_URL)

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith("/Library/Application Support/RooCode/mdm.json")
		})

		it("should use correct path for macOS in development", async () => {
			vi.mocked(os.platform).mockReturnValue("darwin")
			vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith("/Library/Application Support/RooCode/mdm.dev.json")
		})

		it("should use correct path for Linux in production", async () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(getClerkBaseUrl).mockReturnValue(PRODUCTION_CLERK_BASE_URL)

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith("/etc/roo-code/mdm.json")
		})

		it("should use correct path for Linux in development", async () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith("/etc/roo-code/mdm.dev.json")
		})

		it("should default to dev config when NODE_ENV is not set", async () => {
			vi.mocked(os.platform).mockReturnValue("darwin")
			vi.mocked(getClerkBaseUrl).mockReturnValue("https://dev.clerk.roocode.com")

			// Important: Clear previous calls and set up a new mock
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValueOnce({ code: "ENOENT" })

			await MdmService.createInstance()

			expect(safeReadJson).toHaveBeenCalledWith("/Library/Application Support/RooCode/mdm.dev.json")
		})
	})

	describe("compliance checking", () => {
		it("should be compliant when no MDM policy exists", async () => {
			// Default mock setup is fine (ENOENT)

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(true)
		})

		it("should be compliant when authenticated and no org requirement", async () => {
			const mockConfig = { requireCloudAuth: true }
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			vi.mocked(CloudService.hasInstance).mockReturnValue(true)
			vi.mocked(CloudService.instance.hasOrIsAcquiringActiveSession).mockReturnValue(true)

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(true)
		})

		it("should be non-compliant when not authenticated", async () => {
			// Create a mock config that requires cloud auth
			const mockConfig = { requireCloudAuth: true }

			// Important: Use mockResolvedValueOnce instead of mockImplementation
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			// Mock CloudService to indicate no instance
			vi.mocked(CloudService.hasInstance).mockReturnValue(false)

			// This should never be called since hasInstance is false
			vi.mocked(CloudService.instance.hasOrIsAcquiringActiveSession).mockReturnValue(false)

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(false)
			if (!compliance.compliant) {
				expect(compliance.reason).toContain("Your organization requires Roo Code Cloud authentication")
			}
		})

		it("should be non-compliant when wrong organization", async () => {
			const mockConfig = {
				requireCloudAuth: true,
				organizationId: "required-org-123",
			}

			// Important: Use mockResolvedValueOnce instead of mockImplementation
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			// Mock CloudService to have instance and active session but wrong org
			vi.mocked(CloudService.hasInstance).mockReturnValue(true)
			vi.mocked(CloudService.instance.hasOrIsAcquiringActiveSession).mockReturnValue(true)
			vi.mocked(CloudService.instance.getOrganizationId).mockReturnValue("different-org-456")

			// Mock getStoredOrganizationId to also return wrong org
			vi.mocked(CloudService.instance.getStoredOrganizationId).mockReturnValue("different-org-456")

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(false)
			if (!compliance.compliant) {
				expect(compliance.reason).toContain(
					"You must be authenticated with your organization's Roo Code Cloud account",
				)
			}
		})

		it("should be compliant when correct organization", async () => {
			const mockConfig = {
				requireCloudAuth: true,
				organizationId: "correct-org-123",
			}
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			vi.mocked(CloudService.hasInstance).mockReturnValue(true)
			vi.mocked(CloudService.instance.hasOrIsAcquiringActiveSession).mockReturnValue(true)
			vi.mocked(CloudService.instance.getOrganizationId).mockReturnValue("correct-org-123")

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(true)
		})

		it("should be compliant when in attempting-session state", async () => {
			const mockConfig = { requireCloudAuth: true }
			vi.mocked(safeReadJson).mockResolvedValueOnce(mockConfig)

			vi.mocked(CloudService.hasInstance).mockReturnValue(true)
			// Mock attempting session (not active, but acquiring)
			vi.mocked(CloudService.instance.hasOrIsAcquiringActiveSession).mockReturnValue(true)

			const service = await MdmService.createInstance()
			const compliance = service.isCompliant()

			expect(compliance.compliant).toBe(true)
		})
	})

	describe("singleton pattern", () => {
		it("should throw error when accessing instance before creation", () => {
			expect(() => MdmService.getInstance()).toThrow("MdmService not initialized")
		})

		it("should throw error when creating instance twice", async () => {
			// Reset the mock to ensure we can check calls
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValue({ code: "ENOENT" })

			await MdmService.createInstance()

			await expect(MdmService.createInstance()).rejects.toThrow("instance already exists")
		})

		it("should return same instance", async () => {
			// Reset the mock to ensure we can check calls
			vi.mocked(safeReadJson).mockClear()
			vi.mocked(safeReadJson).mockRejectedValue({ code: "ENOENT" })

			const service1 = await MdmService.createInstance()
			const service2 = MdmService.getInstance()

			expect(service1).toBe(service2)
		})
	})
})
