import { render, screen } from "@/utils/test-utils"
import { describe, it, expect, vi } from "vitest"
import { AccountView } from "../AccountView"

// Mock the translation context
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"account:title": "Account",
				"settings:common.done": "Done",
				"account:signIn": "Connect to Roo Code Cloud",
				"account:cloudBenefitsTitle": "Connect to Roo Code Cloud",
				"account:cloudBenefitsSubtitle": "Sync your prompts and telemetry to enable:",
				"account:cloudBenefitHistory": "Online task history",
				"account:cloudBenefitSharing": "Sharing and collaboration features",
				"account:cloudBenefitMetrics": "Task, token, and cost-based usage metrics",
				"account:logOut": "Log out",
				"account:connect": "Connect",
				"account:visitCloudWebsite": "Visit Cloud Website",
				"account:remoteControl": "Remote Control",
				"account:remoteControlDescription": "Allow remote control of this extension",
				"account:profilePicture": "Profile Picture",
			}
			return translations[key] || key
		},
	}),
}))

// Mock vscode utilities
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock telemetry client
vi.mock("@src/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
	},
}))

// Mock the extension state context
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		remoteControlEnabled: false,
		setRemoteControlEnabled: vi.fn(),
	}),
}))

// Mock window global for images
Object.defineProperty(window, "IMAGES_BASE_URI", {
	value: "/images",
	writable: true,
})

describe("AccountView", () => {
	it("should display benefits when user is not authenticated", () => {
		render(
			<AccountView
				userInfo={null}
				isAuthenticated={false}
				cloudApiUrl="https://app.roocode.com"
				onDone={() => {}}
			/>,
		)

		// Check that the benefits section is displayed
		expect(screen.getByRole("heading", { name: "Connect to Roo Code Cloud" })).toBeInTheDocument()
		expect(screen.getByText("Sync your prompts and telemetry to enable:")).toBeInTheDocument()
		expect(screen.getByText("Online task history")).toBeInTheDocument()
		expect(screen.getByText("Sharing and collaboration features")).toBeInTheDocument()
		expect(screen.getByText("Task, token, and cost-based usage metrics")).toBeInTheDocument()

		// Check that the connect button is also present
		expect(screen.getByText("Connect")).toBeInTheDocument()
	})

	it("should not display benefits when user is authenticated", () => {
		const mockUserInfo = {
			name: "Test User",
			email: "test@example.com",
		}

		render(
			<AccountView
				userInfo={mockUserInfo}
				isAuthenticated={true}
				cloudApiUrl="https://app.roocode.com"
				onDone={() => {}}
			/>,
		)

		// Check that the benefits section is NOT displayed
		expect(screen.queryByText("Sync your prompts and telemetry to enable:")).not.toBeInTheDocument()
		expect(screen.queryByText("Online task history")).not.toBeInTheDocument()
		expect(screen.queryByText("Sharing and collaboration features")).not.toBeInTheDocument()
		expect(screen.queryByText("Task, token, and cost-based usage metrics")).not.toBeInTheDocument()

		// Check that user info is displayed instead
		expect(screen.getByText("Test User")).toBeInTheDocument()
		expect(screen.getByText("test@example.com")).toBeInTheDocument()
	})

	it("should display remote control toggle when user has extension bridge enabled", () => {
		const mockUserInfo = {
			name: "Test User",
			email: "test@example.com",
			extensionBridgeEnabled: true,
		}

		render(
			<AccountView
				userInfo={mockUserInfo}
				isAuthenticated={true}
				cloudApiUrl="https://app.roocode.com"
				onDone={() => {}}
			/>,
		)

		// Check that the remote control toggle is displayed
		expect(screen.getByTestId("remote-control-toggle")).toBeInTheDocument()
		expect(screen.getByText("Remote Control")).toBeInTheDocument()
		expect(screen.getByText("Allow remote control of this extension")).toBeInTheDocument()
	})

	it("should not display remote control toggle when user does not have extension bridge enabled", () => {
		const mockUserInfo = {
			name: "Test User",
			email: "test@example.com",
			extensionBridgeEnabled: false,
		}

		render(
			<AccountView
				userInfo={mockUserInfo}
				isAuthenticated={true}
				cloudApiUrl="https://app.roocode.com"
				onDone={() => {}}
			/>,
		)

		// Check that the remote control toggle is NOT displayed
		expect(screen.queryByTestId("remote-control-toggle")).not.toBeInTheDocument()
		expect(screen.queryByText("Remote Control")).not.toBeInTheDocument()
	})
})
