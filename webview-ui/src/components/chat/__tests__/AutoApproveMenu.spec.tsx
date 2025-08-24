import { render, fireEvent, screen, waitFor } from "@/utils/test-utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import AutoApproveMenu from "../AutoApproveMenu"
import userEvent from "@testing-library/user-event"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext")

// Mock translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:autoApprove.title": "Auto-approve",
				"chat:autoApprove.none": "None selected",
				"chat:autoApprove.selectOptionsFirst": "Select at least one option below to enable auto-approval",
				"chat:autoApprove.description": "Configure auto-approval settings",
				"settings:autoApprove.readOnly.label": "Read-only operations",
				"settings:autoApprove.write.label": "Write operations",
				"settings:autoApprove.execute.label": "Execute operations",
				"settings:autoApprove.browser.label": "Browser operations",
				"settings:autoApprove.modeSwitch.label": "Mode switches",
				"settings:autoApprove.mcp.label": "MCP operations",
				"settings:autoApprove.subtasks.label": "Subtasks",
				"settings:autoApprove.resubmit.label": "Resubmit",
				"settings:autoApprove.followupQuestions.label": "Follow-up questions",
				"settings:autoApprove.updateTodoList.label": "Update todo list",
				"settings:autoApprove.apiRequestLimit.title": "API request limit",
				"settings:autoApprove.apiRequestLimit.unlimited": "Unlimited",
				"settings:autoApprove.apiRequestLimit.description": "Limit the number of API requests",
				"settings:autoApprove.readOnly.outsideWorkspace": "Also allow outside workspace",
				"settings:autoApprove.write.outsideWorkspace": "Also allow outside workspace",
				"settings:autoApprove.write.delay": "Delay",
			}
			return translations[key] || key
		},
	}),
}))

// Get the mocked postMessage function
const mockPostMessage = vscode.postMessage as ReturnType<typeof vi.fn>

describe("AutoApproveMenu", () => {
	const defaultExtensionState = {
		autoApprovalEnabled: true,
		alwaysAllowReadOnly: false,
		alwaysAllowReadOnlyOutsideWorkspace: false,
		alwaysAllowWrite: false,
		alwaysAllowWriteOutsideWorkspace: false,
		alwaysAllowExecute: false,
		alwaysAllowBrowser: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysApproveResubmit: false,
		alwaysAllowFollowupQuestions: false,
		alwaysAllowUpdateTodoList: false,
		writeDelayMs: 3000,
		allowedMaxRequests: undefined,
		setAutoApprovalEnabled: vi.fn(),
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
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue(defaultExtensionState)
	})

	describe("Master checkbox behavior", () => {
		it("should show all icons with none highlighted when no sub-options are selected", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowWrite: false,
				alwaysAllowExecute: false,
				alwaysAllowBrowser: false,
				alwaysAllowModeSwitch: false,
			})

			render(<AutoApproveMenu />)

			const container = screen.getByText("Auto-approve").parentElement?.parentElement

			// All primary icons are rendered
			expect(container?.querySelector(".codicon-eye")).toBeInTheDocument()
			expect(container?.querySelector(".codicon-edit")).toBeInTheDocument()
			expect(container?.querySelector(".codicon-terminal")).toBeInTheDocument()

			// None are active
			expect(container?.querySelector(".codicon-eye")?.getAttribute("data-active")).toBe("false")
			expect(container?.querySelector(".codicon-edit")?.getAttribute("data-active")).toBe("false")
			expect(container?.querySelector(".codicon-terminal")?.getAttribute("data-active")).toBe("false")

			// "None selected" helper text is not shown anymore
			expect(screen.queryByText("None selected")).not.toBeInTheDocument()
		})

		it("should highlight the enabled icons when sub-options are selected", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: false,
			})

			render(<AutoApproveMenu />)

			const container = screen.getByText("Auto-approve").parentElement?.parentElement as HTMLElement
			const eyeIcon = container.querySelector(".codicon-eye") as HTMLElement
			const editIcon = container.querySelector(".codicon-edit") as HTMLElement

			expect(eyeIcon).toBeInTheDocument()
			expect(editIcon).toBeInTheDocument()

			expect(eyeIcon.getAttribute("data-active")).toBe("true")
			expect(editIcon.getAttribute("data-active")).toBe("false")
		})

		it("should not allow toggling master checkbox when no options are selected", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
			})

			render(<AutoApproveMenu />)

			// Click on the master checkbox
			const masterCheckbox = screen.getByRole("checkbox")
			fireEvent.click(masterCheckbox)

			// Should not send any message since no options are selected
			expect(mockPostMessage).not.toHaveBeenCalled()
		})

		it("should toggle master checkbox when options are selected", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
			})

			render(<AutoApproveMenu />)

			// Click on the master checkbox
			const masterCheckbox = screen.getByRole("checkbox")
			fireEvent.click(masterCheckbox)

			// Should toggle the master checkbox
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "autoApprovalEnabled",
				bool: false,
			})
		})
	})

	describe("Sub-option toggles", () => {
		it("should toggle read-only operations", async () => {
			const mockSetAlwaysAllowReadOnly = vi.fn()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveMenu />)

			// Expand the menu
			const menuContainer = screen.getByText("Auto-approve").parentElement
			fireEvent.click(menuContainer!)

			// Wait for the menu to expand and find the read-only button
			await waitFor(() => {
				expect(screen.getByTestId("always-allow-readonly-toggle")).toBeInTheDocument()
			})

			const readOnlyButton = screen.getByTestId("always-allow-readonly-toggle")
			fireEvent.click(readOnlyButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowReadOnly",
				bool: true,
			})
		})

		it("should toggle write operations", async () => {
			const mockSetAlwaysAllowWrite = vi.fn()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysAllowWrite: mockSetAlwaysAllowWrite,
			})

			render(<AutoApproveMenu />)

			// Expand the menu
			const menuContainer = screen.getByText("Auto-approve").parentElement
			fireEvent.click(menuContainer!)

			await waitFor(() => {
				expect(screen.getByTestId("always-allow-write-toggle")).toBeInTheDocument()
			})

			const writeButton = screen.getByTestId("always-allow-write-toggle")
			fireEvent.click(writeButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowWrite",
				bool: true,
			})
		})
	})

	describe("Complex scenarios", () => {
		it("should highlight multiple enabled icons in collapsed view", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
				alwaysAllowExecute: true,
			})

			render(<AutoApproveMenu />)

			const container = screen.getByText("Auto-approve").parentElement?.parentElement as HTMLElement
			expect(container.querySelector("button.codicon-eye")?.getAttribute("data-active")).toBe("true") // Read
			expect(container.querySelector("button.codicon-edit")?.getAttribute("data-active")).toBe("true") // Write
			expect(container.querySelector("button.codicon-terminal")?.getAttribute("data-active")).toBe("true") // Execute
		})

		it("should toggle options when clicking icons in collapsed view", () => {
			const mockSetAlwaysAllowReadOnly = vi.fn()
			const mockSetAlwaysAllowWrite = vi.fn()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowWrite: false,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
				setAlwaysAllowWrite: mockSetAlwaysAllowWrite,
			})

			render(<AutoApproveMenu />)

			const container = screen.getByText("Auto-approve").parentElement?.parentElement as HTMLElement
			const eyeButton = container.querySelector("button.codicon-eye") as HTMLElement
			const editButton = container.querySelector("button.codicon-edit") as HTMLElement

			// Click the read-only icon
			fireEvent.click(eyeButton)
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowReadOnly",
				bool: true,
			})
			expect(mockSetAlwaysAllowReadOnly).toHaveBeenCalledWith(true)

			// Click the write icon
			fireEvent.click(editButton)
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowWrite",
				bool: true,
			})
			expect(mockSetAlwaysAllowWrite).toHaveBeenCalledWith(true)
		})

		it("should display tooltips on icon buttons in collapsed view", async () => {
			const user = userEvent.setup()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
				alwaysAllowExecute: true,
			})

			render(<AutoApproveMenu />)

			// Find the icon buttons
			const container = screen.getByText("Auto-approve").parentElement?.parentElement
			const eyeButton = container?.querySelector("button.codicon-eye") as HTMLElement
			const editButton = container?.querySelector("button.codicon-edit") as HTMLElement
			const terminalButton = container?.querySelector("button.codicon-terminal") as HTMLElement

			// Verify icon buttons are present
			expect(eyeButton).toBeInTheDocument()
			expect(editButton).toBeInTheDocument()
			expect(terminalButton).toBeInTheDocument()

			// Test read-only icon tooltip
			await user.hover(eyeButton)
			await waitFor(() => {
				expect(screen.getByRole("tooltip")).toHaveTextContent("Read-only operations")
			})
		})

		it("should handle enabling first option when none selected", async () => {
			const mockSetAutoApprovalEnabled = vi.fn()
			const mockSetAlwaysAllowReadOnly = vi.fn()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				setAutoApprovalEnabled: mockSetAutoApprovalEnabled,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveMenu />)

			// Expand the menu
			const menuContainer = screen.getByText("Auto-approve").parentElement
			fireEvent.click(menuContainer!)

			await waitFor(() => {
				expect(screen.getByTestId("always-allow-readonly-toggle")).toBeInTheDocument()
			})

			// Enable read-only
			const readOnlyButton = screen.getByTestId("always-allow-readonly-toggle")
			fireEvent.click(readOnlyButton)

			// Should enable the sub-option
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowReadOnly",
				bool: true,
			})

			// Should also enable master auto-approval
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "autoApprovalEnabled",
				bool: true,
			})
		})

		it("should handle disabling last option", async () => {
			const mockSetAutoApprovalEnabled = vi.fn()
			const mockSetAlwaysAllowReadOnly = vi.fn()

			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				setAutoApprovalEnabled: mockSetAutoApprovalEnabled,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveMenu />)

			// Expand the menu
			const menuContainer = screen.getByText("Auto-approve").parentElement
			fireEvent.click(menuContainer!)

			await waitFor(() => {
				expect(screen.getByTestId("always-allow-readonly-toggle")).toBeInTheDocument()
			})

			// Disable read-only (the last enabled option)
			const readOnlyButton = screen.getByTestId("always-allow-readonly-toggle")
			fireEvent.click(readOnlyButton)

			// Should disable the sub-option
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "alwaysAllowReadOnly",
				bool: false,
			})

			// Should also disable master auto-approval
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "autoApprovalEnabled",
				bool: false,
			})
		})
	})
})
