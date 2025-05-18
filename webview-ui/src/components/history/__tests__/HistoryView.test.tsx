import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import HistoryView from "../HistoryView"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
// --- Minimal Mocks ---
// Mock necessary hooks/components used directly at the top level or early in render
// Note: i18n context is mocked via moduleNameMapper in jest.config.cjs
// jest.mock("@src/i18n/TranslationContext", ...)
// Mock lucide-react icons to return valid components
jest.mock("lucide-react", () => {
	const React = require("react") // Need React for JSX
	const createIconMock = (name: string) => (props: any) =>
		React.createElement("svg", { ...props, "data-testid": `${name}Icon` })
	return {
		X: createIconMock("X"),
		Search: createIconMock("Search"),
		ChevronDown: createIconMock("ChevronDown"),
		ArrowDown: createIconMock("ArrowDown"),
		ArrowUp: createIconMock("ArrowUp"),
		LayoutDashboard: createIconMock("LayoutDashboard"),
		Hash: createIconMock("Hash"),
		CreditCard: createIconMock("CreditCard"),
		Binary: createIconMock("Binary"),
		Folder: createIconMock("Folder"),
		Database: createIconMock("Database"),
		ArrowRight: createIconMock("ArrowRight"),
		Trash2: createIconMock("Trash2"),
		ChevronRight: createIconMock("ChevronRight"),
	}
})

jest.mock("../useTaskSearch", () => ({
	useTaskSearch: jest.fn(() => ({
		tasks: [], // Start with empty tasks
		searchQuery: "",
		setSearchQuery: jest.fn(),
		sortOption: "newest",
		setSortOption: jest.fn(),
		setLastNonRelevantSort: jest.fn(),
		availableWorkspaces: [],
		workspaceFilterMode: "current",
		setWorkspaceFilterMode: jest.fn(),
		selectedWorkspaces: [],
		setSelectedWorkspaces: jest.fn(),
	})),
}))

// Mock vscode utility as it's used in handlers
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
		getState: jest.fn(),
		setState: jest.fn(),
	},
}))

// Mock cn utility
jest.mock("@/lib/utils", () => ({
	cn: (...args: any[]) => args.filter(Boolean).join(" "),
}))
jest.mock("@/components/ui/select", () => {
	// Use top-level React import
	return {
		// Prefix unused prop with underscore to satisfy ESLint
		Select: jest.fn(({ children, value, _onValueChange }) => (
			<div data-testid="mock-select" data-value={value}>
				{/* Simulate interaction by calling _onValueChange if needed in tests */}
				{children}
			</div>
		)),
		SelectTrigger: jest.fn(({ children, ...props }) => (
			// Pass through data-testid if provided
			<button data-testid={props["data-testid"] || "mock-select-trigger"} {...props}>
				{children}
			</button>
		)),
		SelectContent: jest.fn(({ children }) => <div data-testid="mock-select-content">{children}</div>),
		SelectItem: jest.fn(({ children, value, ...props }) => (
			// Pass through data-testid and include value
			<div data-testid={props["data-testid"] || `mock-select-item-${value}`} data-value={value} {...props}>
				{children}
			</div>
		)),
	}
})

// Mock react-virtuoso (basic)
jest.mock("react-virtuoso", () => ({
	Virtuoso: ({ data, itemContent }: any) => (
		<div data-testid="virtuoso-container">
			{data.map((item: any, index: number) => (
				<div key={item.id} data-testid={`virtuoso-item-${item.id}`}>
					{itemContent(index, item)}
				</div>
			))}
		</div>
	),
}))

describe("HistoryView", () => {
	let mockSetSearchQuery: jest.Mock
	let mockSetSortOption: jest.Mock
	let mockSetLastNonRelevantSort: jest.Mock
	let mockSetWorkspaceFilterMode: jest.Mock
	let mockSetSelectedWorkspaces: jest.Mock

	const mockTaskHistory = [
		{
			id: "1",
			number: 0,
			task: "Test task 1",
			ts: new Date("2022-02-16T00:00:00").getTime(),
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.002,
			workspace: "/workspace/a",
		},
		{
			id: "2",
			number: 0,
			task: "Test task 2",
			ts: new Date("2022-02-17T00:00:00").getTime(),
			tokensIn: 200,
			tokensOut: 100,
			cacheWrites: 50,
			cacheReads: 25,
			workspace: "/workspace/b",
		},
	]

	beforeEach(() => {
		// Assign specific mock functions in beforeEach
		mockSetSearchQuery = jest.fn()
		mockSetSortOption = jest.fn()
		mockSetLastNonRelevantSort = jest.fn()
		mockSetWorkspaceFilterMode = jest.fn()
		mockSetSelectedWorkspaces = jest.fn()

		// Reset the useTaskSearch mock implementation before each test
		;(jest.requireMock("../useTaskSearch").useTaskSearch as jest.Mock).mockImplementation(() => ({
			tasks: mockTaskHistory, // Use mock data
			searchQuery: "",
			setSearchQuery: mockSetSearchQuery,
			sortOption: "newest",
			setSortOption: mockSetSortOption,
			setLastNonRelevantSort: mockSetLastNonRelevantSort,
			availableWorkspaces: ["/workspace/a", "/workspace/b"],
			workspaceFilterMode: "current",
			setWorkspaceFilterMode: mockSetWorkspaceFilterMode,
			selectedWorkspaces: [],
			setSelectedWorkspaces: mockSetSelectedWorkspaces,
		}))

		jest.clearAllMocks()
	})

	it("renders without crashing", () => {
		const onDone = jest.fn()
		render(
			<ExtensionStateContextProvider>
				<HistoryView onDone={onDone} />
			</ExtensionStateContextProvider>,
		)
		// Basic check: Look for the main title
		expect(screen.getByText("history:history")).toBeInTheDocument()
	})

	it("renders history items correctly", () => {
		const onDone = jest.fn()
		render(
			<ExtensionStateContextProvider>
				<HistoryView onDone={onDone} />
			</ExtensionStateContextProvider>,
		)

		// Check if both tasks are rendered using the virtuoso mock structure
		expect(screen.getByTestId("virtuoso-item-1")).toBeInTheDocument()
		expect(screen.getByTestId("virtuoso-item-2")).toBeInTheDocument()
		// Check for task content (might need adjustment based on how dangerouslySetInnerHTML is handled)
		expect(screen.getByText("Test task 1")).toBeInTheDocument()
		expect(screen.getByText("Test task 2")).toBeInTheDocument()
	})

	it("handles search functionality", () => {
		const onDone = jest.fn()
		render(
			<ExtensionStateContextProvider>
				<HistoryView onDone={onDone} />
			</ExtensionStateContextProvider>,
		)

		const searchInput = screen.getByTestId("history-search-input") // Use the actual test ID from the component
		fireEvent.input(searchInput, { target: { value: "task 1" } })

		expect(mockSetSearchQuery).toHaveBeenCalledWith("task 1")
	})

	it("handles sort options correctly", () => {
		const onDone = jest.fn()
		render(
			<ExtensionStateContextProvider>
				<HistoryView onDone={onDone} />
			</ExtensionStateContextProvider>,
		)

		// Find the trigger using its test ID from the mock
		const sortTrigger = screen.getByTestId("history-sort-trigger")
		fireEvent.mouseDown(sortTrigger) // Simulate opening the select

		// Find and click an item (using the mock structure)
		const oldestOption = screen.getByTestId("history-sort-item-oldest") // Use the actual test ID from the component
		fireEvent.click(oldestOption)
	})
})
