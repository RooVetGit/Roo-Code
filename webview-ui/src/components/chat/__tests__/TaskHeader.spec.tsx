// npx vitest src/components/chat/__tests__/TaskHeader.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings } from "@roo-code/types"

import TaskHeader, { TaskHeaderProps } from "../TaskHeader"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key, // Simple mock that returns the key
	}),
	// Mock initReactI18next to prevent initialization errors in tests
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the VSCodeBadge component
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children: React.ReactNode }) => <div data-testid="vscode-badge">{children}</div>,
}))

// Mock the ExtensionStateContext
const { mockGetCurrentTaskItem, mockSetCurrentTaskItem } = vi.hoisted(() => {
	let currentTaskItem: any = { id: "test-task-id", mode: "code" }
	return {
		mockGetCurrentTaskItem: () => currentTaskItem,
		mockSetCurrentTaskItem: (newItem: any) => {
			currentTaskItem = newItem
		},
	}
})

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			apiProvider: "anthropic",
			apiKey: "test-api-key",
			apiModelId: "claude-3-opus-20240229",
		} as ProviderSettings,
		currentTaskItem: mockGetCurrentTaskItem(),
		customModes: [],
	}),
}))

// Mock ModeBadge component
vi.mock("@/components/common/ModeBadge", () => ({
	ModeBadge: ({ modeSlug }: { modeSlug: string }) => <div data-testid="mode-badge">{modeSlug}</div>,
}))

describe("TaskHeader", () => {
	const defaultProps: TaskHeaderProps = {
		task: { type: "say", ts: Date.now(), text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.05,
		contextTokens: 200,
		buttonsDisabled: false,
		handleCondenseContext: vi.fn(),
		onClose: vi.fn(),
	}

	const queryClient = new QueryClient()

	const renderTaskHeader = (props: Partial<TaskHeaderProps> = {}) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<TaskHeader {...defaultProps} {...props} />
			</QueryClientProvider>,
		)
	}

	it("should display cost when totalCost is greater than 0", () => {
		renderTaskHeader()
		expect(screen.getByText("$0.05")).toBeInTheDocument()
	})

	it("should not display cost when totalCost is 0", () => {
		renderTaskHeader({ totalCost: 0 })
		expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is null", () => {
		renderTaskHeader({ totalCost: null as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is undefined", () => {
		renderTaskHeader({ totalCost: undefined as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is NaN", () => {
		renderTaskHeader({ totalCost: NaN })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should render the condense context button", () => {
		renderTaskHeader()
		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton?.querySelector("svg")).toBeInTheDocument()
	})

	it("should call handleCondenseContext when condense context button is clicked", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ handleCondenseContext })
		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).toHaveBeenCalledWith("test-task-id")
	})

	it("should disable the condense context button when buttonsDisabled is true", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ buttonsDisabled: true, handleCondenseContext })
		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton).toBeDisabled()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).not.toHaveBeenCalled()
	})

	it("should display mode badge when currentTaskItem has mode", () => {
		renderTaskHeader()
		expect(screen.getByTestId("mode-badge")).toBeInTheDocument()
		expect(screen.getByText("code")).toBeInTheDocument()
	})

	it("should not display mode badge when currentTaskItem has no mode", () => {
		// Override the mock for this test
		const originalTaskItem = mockGetCurrentTaskItem()
		mockSetCurrentTaskItem({
			id: "test-task-id",
			number: 1,
			ts: Date.now(),
			task: "Test task",
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.05,
			// No mode property
		})

		renderTaskHeader()
		expect(screen.queryByTestId("mode-badge")).not.toBeInTheDocument()

		// Restore original mock
		mockSetCurrentTaskItem(originalTaskItem)
	})
})
