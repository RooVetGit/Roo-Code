import { render, screen, fireEvent } from "@/utils/test-utils"
import { describe, it, expect, vi, beforeEach } from "vitest"
import AutoApproveMenu from "../components/chat/AutoApproveMenu"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock window.postMessage
const mockPostMessage = vi.fn()
window.postMessage = mockPostMessage

// Mock useExtensionState
const mockUseExtensionState = vi.fn()

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const createMockExtensionState = (overrides = {}) => ({
	autoApprovalEnabled: false,
	setAutoApprovalEnabled: vi.fn(),
	alwaysAllowReadOnly: false,
	alwaysAllowWrite: false,
	alwaysAllowExecute: false,
	alwaysAllowBrowser: false,
	alwaysAllowMcp: false,
	alwaysAllowModeSwitch: false,
	alwaysAllowSubtasks: false,
	alwaysApproveResubmit: false,
	alwaysAllowFollowupQuestions: false,
	alwaysAllowUpdateTodoList: false,
	allowedMaxRequests: undefined,
	setAlwaysAllowReadOnly: vi.fn(),
	setAlwaysAllowWrite: vi.fn(),
	setAlwaysAllowExecute: vi.fn(),
	setAlwaysAllowBrowser: vi.fn(),
	setAlwaysAllowMcp: vi.fn(),
	setAlwaysAllowModeSwitch: vi.fn(),
	setAlwaysAllowSubtasks: vi.fn(),
	setAlwaysApproveResubmit: vi.fn(),
	setAlwaysAllowFollowupQuestions: vi.fn(),
	setAlwaysAllowUpdateTodoList: vi.fn(),
	setAllowedMaxRequests: vi.fn(),
	...overrides,
})

describe("AutoApproveMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue(createMockExtensionState())
	})

	it("renders without crashing", () => {
		render(<AutoApproveMenu />)
		expect(screen.getByText("chat:autoApprove.title")).toBeInTheDocument()
	})

	it("expands when clicked", () => {
		render(<AutoApproveMenu />)

		// Initially, the expanded content should not be visible
		const expandedContainer = document.querySelector(".flex.flex-col.gap-2.max-h-\\[400px\\].overflow-y-auto")
		expect(expandedContainer).not.toBeInTheDocument()

		// Click to expand
		const titleArea = screen.getByText("chat:autoApprove.title").parentElement?.parentElement
		fireEvent.click(titleArea!)

		// Now the expanded content should be visible
		const expandedContent = document.querySelector(".flex.flex-col.gap-2.max-h-\\[400px\\].overflow-y-auto")
		expect(expandedContent).toBeInTheDocument()
	})

	it("expanded content has max-height and overflow-y auto to prevent overflow", () => {
		render(<AutoApproveMenu />)

		// Click to expand
		const titleArea = screen.getByText("chat:autoApprove.title").parentElement?.parentElement
		fireEvent.click(titleArea!)

		// Find the expanded content container
		const expandedContent = document.querySelector(".flex.flex-col.gap-2.max-h-\\[400px\\].overflow-y-auto")

		// Check that it exists and has the correct classes
		expect(expandedContent).toBeInTheDocument()
		expect(expandedContent).toHaveClass("max-h-[400px]", "overflow-y-auto")
	})

	it("collapses when clicked again", () => {
		render(<AutoApproveMenu />)

		// Click to expand
		const titleArea = screen.getByText("chat:autoApprove.title").parentElement?.parentElement
		fireEvent.click(titleArea!)

		// Verify expanded
		const expandedContent = document.querySelector(".flex.flex-col.gap-2.max-h-\\[400px\\].overflow-y-auto")
		expect(expandedContent).toBeInTheDocument()

		// Click to collapse
		fireEvent.click(titleArea!)

		// Verify collapsed
		const collapsedContent = document.querySelector(".flex.flex-col.gap-2.max-h-\\[400px\\].overflow-y-auto")
		expect(collapsedContent).not.toBeInTheDocument()
	})

	it("displays enabled actions list when toggles are enabled", () => {
		mockUseExtensionState.mockReturnValue(
			createMockExtensionState({
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
			}),
		)

		render(<AutoApproveMenu />)

		// Should show the enabled actions instead of "none"
		expect(screen.queryByText("chat:autoApprove.none")).not.toBeInTheDocument()
	})
})
