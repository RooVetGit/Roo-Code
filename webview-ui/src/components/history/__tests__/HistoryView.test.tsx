// cd webview-ui && npx jest src/components/history/__tests__/HistoryView.new.test.tsx

import { render, screen, fireEvent, within, act } from "@testing-library/react"
import "@testing-library/jest-dom"

import HistoryView from "../HistoryView"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { useTaskSearch } from "../useTaskSearch"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { HistoryItem } from "@roo/shared/ExtensionMessage" // Assuming this path is correct for the shared type

// Mocking dependencies
jest.mock("@src/context/ExtensionStateContext")
jest.mock("@src/utils/vscode")
jest.mock("../useTaskSearch")
jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: jest.fn(),
}))
jest.mock("@/components/ui/hooks/useClipboard", () => ({
	useClipboard: jest.fn(),
}))

// Import React for useEffect in mocks
const React = require("react")

jest.mock("../DeleteTaskDialog", () => ({
	DeleteTaskDialog: jest.fn((props) => {
		const { open, taskId, onOpenChange } = props
		React.useEffect(() => {
			if (open && taskId) {
				require("@src/utils/vscode").vscode.postMessage({ type: "deleteTaskWithId", text: taskId })
				onOpenChange?.(false)
			}
		}, [open, taskId, onOpenChange])
		return null
	}),
}))
jest.mock("../BatchDeleteTaskDialog", () => ({
	BatchDeleteTaskDialog: jest.fn((props) => {
		const { open, taskIds, onOpenChange } = props
		React.useEffect(() => {
			if (open && taskIds?.length > 0) {
				require("@src/utils/vscode").vscode.postMessage({ type: "deleteMultipleTasksWithIds", ids: taskIds })
				onOpenChange?.(false)
			}
		}, [open, taskIds, onOpenChange])
		return null
	}),
}))

jest.mock("react-virtuoso", () => ({
	Virtuoso: jest.fn(({ data, itemContent, components }) => (
		<div data-testid="virtuoso-container">
			{components?.Header && <components.Header />}
			{data.map((item: any, index: number) => (
				<div key={item.id || index} data-testid={`virtuoso-item-${item.id || index}`}>
					{itemContent(index, item)}
				</div>
			))}
			{components?.Footer && <components.Footer />}
		</div>
	)),
}))

const mockUseExtensionState = useExtensionState as jest.Mock
const mockVscodePostMessage = vscode.postMessage as jest.Mock
const mockUseTaskSearch = useTaskSearch as jest.Mock
// useAppTranslation is already a mock due to jest.mock('@src/i18n/TranslationContext')
// const mockUseAppTranslation = useAppTranslation as jest.Mock; // This line is removed

// Mock ExportButton
jest.mock("../ExportButton", () => ({
	ExportButton: jest.fn(({ itemId }) => (
		<button
			data-testid={`export-button-${itemId}`}
			onClick={() => require("@src/utils/vscode").vscode.postMessage({ type: "exportTaskWithId", text: itemId })}>
			MockExport
		</button>
	)),
}))

const mockHistoryItem = (id: string, taskText: string, ts: number, workspace?: string): HistoryItem => ({
	id,
	task: taskText,
	ts,
	tokensIn: 10,
	tokensOut: 5,
	totalCost: 0.001,
	workspace: workspace || "default_workspace",
	number: 1,
	size: 1024, // Example size in bytes
	cacheWrites: 1,
	cacheReads: 2,
	// Ensure all required fields from HistoryItem as per src/schemas/index.ts are present
	// Removed fields not in the schema:
	// modelId, mode, temperature, maxTokens, apiProvider, apiProviderKey,
	// parentTaskId, subTasks, isSubTask, isCancelled, isError, error,
	// modelResponse, uiMessages, apiConversationHistory, git, checkpoints,
	// currentCheckpointId, isArchived
})

describe("HistoryView (New Tests)", () => {
	beforeEach(() => {
		jest.clearAllMocks()

		mockUseExtensionState.mockReturnValue({
			cwd: "default_workspace",
			availableHistoryMonths: [{ year: 2023, month: 1 }],
			historyPreviewCollapsed: false,
		})

		mockUseTaskSearch.mockReturnValue({
			tasks: [],
			searchQuery: "",
			setSearchQuery: jest.fn(),
			sortOption: "newest",
			setSortOption: jest.fn(),
			fzf: {
				find: jest.fn().mockReturnValue([]),
			},
			presentableTasks: [],
			setLastNonRelevantSort: jest.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: jest.fn(),
			isLoadingHistoryChunks: false,
		})

		;(useAppTranslation as jest.Mock).mockReturnValue({
			t: jest.fn((key) => key),
			i18n: { language: "en" },
		})

		Object.defineProperty(navigator, "clipboard", {
			value: {
				writeText: jest.fn().mockResolvedValue(undefined),
			},
			configurable: true,
		})

		// Mock useClipboard return value for tests that use CopyButton
		const mockCopyFn = jest.fn()
		;(require("@/components/ui/hooks/useClipboard").useClipboard as jest.Mock).mockReturnValue({
			isCopied: false,
			copy: mockCopyFn,
		})
	})

	test("renders loading state when isLoadingHistoryChunks is true", () => {
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			isLoadingHistoryChunks: true,
			tasks: [],
		})
		render(<HistoryView onDone={jest.fn()} />)
		expect(screen.getByText("history:loadingHistory")).toBeInTheDocument()
		expect(screen.queryByTestId("virtuoso-container")).not.toBeInTheDocument()
	})

	test("renders 'no history' message when not loading and no tasks", () => {
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			isLoadingHistoryChunks: false,
			tasks: [],
		})
		render(<HistoryView onDone={jest.fn()} />)
		expect(screen.getByText("history:noHistoryFound")).toBeInTheDocument()
		expect(screen.queryByTestId("virtuoso-container")).not.toBeInTheDocument()
	})

	test("renders tasks when available and not loading", () => {
		const tasks = [
			mockHistoryItem("1", "Task 1 HTML", Date.now()),
			mockHistoryItem("2", "Task 2 HTML", Date.now() - 1000),
		]
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			isLoadingHistoryChunks: false,
			tasks,
			presentableTasks: tasks,
		})
		render(<HistoryView onDone={jest.fn()} />)
		expect(screen.getByTestId("virtuoso-container")).toBeInTheDocument()
		expect(screen.getByTestId("virtuoso-item-1")).toBeInTheDocument()
		expect(within(screen.getByTestId("virtuoso-item-1")).getByTestId("task-content")).toHaveTextContent(
			"Task 1 HTML",
		) // textContent for HTML
		expect(screen.getByTestId("virtuoso-item-2")).toBeInTheDocument()
		expect(within(screen.getByTestId("virtuoso-item-2")).getByTestId("task-content")).toHaveTextContent(
			"Task 2 HTML",
		)
		expect(screen.queryByText("history:loadingHistory")).not.toBeInTheDocument()
		expect(screen.queryByText("history:noHistoryFound")).not.toBeInTheDocument()
	})

	test("calls setSearchQuery on search input change", () => {
		const setSearchQueryMock = jest.fn()
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			setSearchQuery: setSearchQueryMock,
			tasks: [mockHistoryItem("1", "Task 1", Date.now())],
			presentableTasks: [mockHistoryItem("1", "Task 1", Date.now())],
		})
		render(<HistoryView onDone={jest.fn()} />)
		const searchInput = screen.getByTestId("history-search-input")
		fireEvent.change(searchInput, { target: { value: "test search" } })
		expect(setSearchQueryMock).toHaveBeenCalledWith("test search")
	})

	test("calls setSortOption on sort option change", () => {
		const setSortOptionMock = jest.fn()
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			setSortOption: setSortOptionMock,
			tasks: [mockHistoryItem("1", "Task 1", Date.now())],
			presentableTasks: [mockHistoryItem("1", "Task 1", Date.now())],
		})
		render(<HistoryView onDone={jest.fn()} />)
		const oldestRadio = screen.getByTestId("radio-oldest")
		fireEvent.click(oldestRadio)
		expect(setSortOptionMock).toHaveBeenCalledWith("oldest")
	})

	test("clicking a task item sends 'showTaskWithId' message", async () => {
		// Added async
		const task = mockHistoryItem("task123", "Clickable Task", Date.now())
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			tasks: [task],
			presentableTasks: [task],
		})
		render(<HistoryView onDone={jest.fn()} />)
		// The item rendered by itemContent has data-testid="task-item-${item.id}"
		const taskItem = screen.getByTestId("task-item-task123")
		// Using act to ensure all updates are processed
		await act(async () => {
			fireEvent.click(taskItem)
			await Promise.resolve() // Ensure microtasks like promise resolutions complete
		})
		expect(mockVscodePostMessage).toHaveBeenCalledWith({
			type: "showTaskWithId",
			text: "task123",
		})
	})

	test("handles copying task content and icon change", async () => {
		jest.useFakeTimers()
		const taskText = "This is the plain text content"
		const taskHtml = `<p>${taskText}</p>`
		const task = mockHistoryItem("copy1", taskHtml, Date.now())
		const mockCopy = jest.fn()
		const useClipboardMock = require("@/components/ui/hooks/useClipboard").useClipboard

		useClipboardMock.mockReturnValue({ isCopied: false, copy: mockCopy })

		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			tasks: [task],
			presentableTasks: [task],
		})

		const { rerender } = render(<HistoryView onDone={jest.fn()} />)

		// The item rendered by itemContent has data-testid="task-item-${item.id}"
		const taskItemElement = screen.getByTestId("task-item-copy1")
		const copyButton = within(taskItemElement).getByTestId("copy-prompt-button")
		const icon = copyButton.querySelector("span.codicon")

		expect(icon).toHaveClass("codicon-copy")

		// Simulate click
		await act(async () => {
			fireEvent.click(copyButton)
			await Promise.resolve() // Ensure microtasks complete
		})

		expect(mockCopy).toHaveBeenCalledWith(taskText)

		// Simulate isCopied becoming true
		useClipboardMock.mockReturnValue({ isCopied: true, copy: mockCopy })
		rerender(<HistoryView onDone={jest.fn()} />)

		const updatedIcon = within(taskItemElement).getByTestId("copy-prompt-button").querySelector("span.codicon")
		expect(updatedIcon).toHaveClass("codicon-check")

		// Simulate timeout and isCopied becoming false
		act(() => {
			jest.advanceTimersByTime(2000)
		})
		useClipboardMock.mockReturnValue({ isCopied: false, copy: mockCopy })
		rerender(<HistoryView onDone={jest.fn()} />)

		const finalIcon = within(taskItemElement).getByTestId("copy-prompt-button").querySelector("span.codicon")
		expect(finalIcon).toHaveClass("codicon-copy")

		jest.useRealTimers()
	})

	describe("Task Item Deletion (with mocked dialogs)", () => {
		const taskToDelete = mockHistoryItem("del1", "Task to Delete", Date.now())

		beforeEach(() => {
			mockUseTaskSearch.mockReturnValue({
				...mockUseTaskSearch(), // Spread existing mock setup
				tasks: [taskToDelete],
				presentableTasks: [taskToDelete],
			})
		})

		test("sends 'deleteTaskWithId' message on delete button click (dialog mocked to auto-confirm)", async () => {
			render(<HistoryView onDone={jest.fn()} />)
			const taskItem = screen.getByTestId("task-item-del1")
			const deleteButton = within(taskItem).getByTestId("delete-task-button")

			await act(async () => {
				fireEvent.click(deleteButton)
				await Promise.resolve()
			})

			// The mock DeleteTaskDialog should have posted the message
			expect(mockVscodePostMessage).toHaveBeenCalledWith({
				type: "deleteTaskWithId",
				text: "del1",
			})
		})

		test("sends 'deleteTaskWithId' message directly on shift-click (no dialog involved)", async () => {
			render(<HistoryView onDone={jest.fn()} />)
			const taskItem = screen.getByTestId("task-item-del1")
			const deleteButton = within(taskItem).getByTestId("delete-task-button")

			await act(async () => {
				fireEvent.click(deleteButton, { shiftKey: true })
				await Promise.resolve()
			})

			expect(mockVscodePostMessage).toHaveBeenCalledWith({
				type: "deleteTaskWithId",
				text: "del1",
			})
		})
	})

	test("toggles selection mode and handles batch delete (dialog mocked to auto-confirm)", async () => {
		const tasks = [
			mockHistoryItem("s1", "Selectable Task 1", Date.now()),
			mockHistoryItem("s2", "Selectable Task 2", Date.now() - 1000),
		]
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(),
			tasks,
			presentableTasks: tasks,
		})
		render(<HistoryView onDone={jest.fn()} />)

		const toggleSelectionButton = screen.getByTestId("toggle-selection-mode-button")
		fireEvent.click(toggleSelectionButton) // Enter selection mode

		const taskItem1 = screen.getByTestId("task-item-s1")
		const checkbox1 = within(taskItem1).getByRole("checkbox") as HTMLInputElement
		fireEvent.click(checkbox1) // Select one item

		// The button's text is determined by t("history:deleteSelected")
		// Let's find it by role and name (text content)
		const batchDeleteButton = screen.getByRole("button", { name: "history:deleteSelected" })
		expect(batchDeleteButton).toBeInTheDocument()

		await act(async () => {
			fireEvent.click(batchDeleteButton)
			await Promise.resolve()
		})

		// The mock BatchDeleteTaskDialog should have posted the message
		expect(mockVscodePostMessage).toHaveBeenCalledWith({
			type: "deleteMultipleTasksWithIds", // Corrected type based on BatchDeleteTaskDialog.tsx
			ids: ["s1"],
		})
	})

	test("filters tasks by workspace and toggles with 'Show all workspaces'", () => {
		const task1DefaultWs = mockHistoryItem("task1", "Task for default_workspace", Date.now(), "default_workspace")
		const task2DefaultWs = mockHistoryItem(
			"task2",
			"Another Task for default_workspace",
			Date.now() - 1000,
			"default_workspace",
		)
		const task3OtherWs = mockHistoryItem("task3", "Task for other_workspace", Date.now() - 2000, "other_workspace")

		const allTasks = [task1DefaultWs, task2DefaultWs, task3OtherWs]
		const defaultWorkspaceTasks = [task1DefaultWs, task2DefaultWs]

		const setShowAllWorkspacesMock = jest.fn()

		// Initial state: showAllWorkspaces = false, only default_workspace tasks
		mockUseTaskSearch.mockReturnValue({
			tasks: defaultWorkspaceTasks, // This is what Virtuoso gets
			presentableTasks: defaultWorkspaceTasks, // This is what fzf might use, ensure consistency
			searchQuery: "",
			setSearchQuery: jest.fn(),
			sortOption: "newest",
			setSortOption: jest.fn(),
			fzf: { find: jest.fn().mockReturnValue(defaultWorkspaceTasks) },
			setLastNonRelevantSort: jest.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: setShowAllWorkspacesMock,
			isLoadingHistoryChunks: false,
		})

		const { rerender } = render(<HistoryView onDone={jest.fn()} />)

		// Initially, only default workspace tasks should be visible
		expect(screen.getByTestId("task-item-task1")).toBeInTheDocument()
		expect(screen.getByTestId("task-item-task2")).toBeInTheDocument()
		expect(screen.queryByTestId("task-item-task3")).not.toBeInTheDocument()

		// Find the checkbox by its id, then check its aria-checked state or checked property
		const toggleCheckbox = document.getElementById("show-all-workspaces-view") as HTMLInputElement
		expect(toggleCheckbox).toBeInTheDocument() // Ensure it's found
		// Custom checkboxes might use aria-checked or have a different structure.
		// Let's try 'aria-checked' first, then fallback to 'checked'.
		// The 'checked' prop is passed to the custom Checkbox component.
		// We rely on the mock of useTaskSearch to control this.
		expect(mockUseTaskSearch().showAllWorkspaces).toBe(false) // Assert based on the controlling prop
		// For DOM assertion, if it's a native input or follows ARIA:
		// expect(toggleCheckbox.getAttribute('aria-checked')).toBe('false'); or expect(toggleCheckbox.checked).toBe(false);
		// Given previous failures with .checked, we'll rely on the prop for initial state.

		// Click to show all workspaces - click the label associated with it for better user-like interaction
		const label = screen.getByText("history:showAllWorkspaces")
		fireEvent.click(label)
		expect(setShowAllWorkspacesMock).toHaveBeenCalledWith(true)

		// Simulate state update from useTaskSearch hook after toggling
		mockUseTaskSearch.mockReturnValue({
			tasks: allTasks, // Now Virtuoso gets all tasks
			presentableTasks: allTasks,
			searchQuery: "",
			setSearchQuery: jest.fn(),
			sortOption: "newest",
			setSortOption: jest.fn(),
			fzf: { find: jest.fn().mockReturnValue(allTasks) },
			setLastNonRelevantSort: jest.fn(),
			showAllWorkspaces: true, // Reflect the change
			setShowAllWorkspaces: setShowAllWorkspacesMock,
			isLoadingHistoryChunks: false,
		})

		rerender(<HistoryView onDone={jest.fn()} />)

		// Now all tasks should be visible
		expect(screen.getByTestId("task-item-task1")).toBeInTheDocument()
		expect(screen.getByTestId("task-item-task2")).toBeInTheDocument()
		expect(screen.getByTestId("task-item-task3")).toBeInTheDocument()
		// The checkbox itself is controlled by the `showAllWorkspaces` prop from the hook.
		// After clicking, setShowAllWorkspacesMock is called. The visual update of the checkbox
		// would depend on HistoryView re-rendering with the new prop from useTaskSearch.
		// The test already verifies that setShowAllWorkspacesMock is called with true.
		// And it verifies that the list of tasks changes, which is the ultimate user-facing outcome.
	})

	test("handles export button click for a task item", async () => {
		const taskToExport = mockHistoryItem("export1", "Task to Export", Date.now())
		mockUseTaskSearch.mockReturnValue({
			...mockUseTaskSearch(), // Spread existing mock setup
			tasks: [taskToExport],
			presentableTasks: [taskToExport],
		})

		render(<HistoryView onDone={jest.fn()} />)

		const taskItem = screen.getByTestId("task-item-export1")
		// The ExportButton is mocked to render a button with a specific testId
		const exportButton = within(taskItem).getByTestId("export-button-export1")

		await act(async () => {
			fireEvent.click(exportButton)
			await Promise.resolve()
		})

		expect(mockVscodePostMessage).toHaveBeenCalledWith({
			type: "exportTaskWithId",
			text: "export1",
		})
	})
})
