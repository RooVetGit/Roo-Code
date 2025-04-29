// npx jest src/components/settings/__tests__/ContextManagementSettings.test.ts

import { render, screen, fireEvent } from "@testing-library/react"

import { ContextManagementSettings } from "@src/components/settings/ContextManagementSettings"

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

jest.mock("@/components/ui", () => ({
	...jest.requireActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
		/>
	),
}))

describe("ContextManagementSettings", () => {
	const defaultProps = {
		maxOpenTabsContext: 20,
		maxWorkspaceFiles: 200,
		showRooIgnoredFiles: false,
		setCachedStateField: jest.fn(),
		// Add mock setters for new props (Added)
		setEnableContextSummarization: jest.fn(),
		setContextSummarizationTriggerThreshold: jest.fn(),
		setContextSummarizationInitialStaticTurns: jest.fn(),
		setContextSummarizationRecentTurns: jest.fn(),
		// Add default values for new state props (Added)
		enableContextSummarization: false,
		contextSummarizationTriggerThreshold: 80,
		contextSummarizationInitialStaticTurns: 5,
		contextSummarizationRecentTurns: 10,
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders all controls", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		// Open tabs context limit
		const openTabsSlider = screen.getByTestId("open-tabs-limit-slider")
		expect(openTabsSlider).toBeInTheDocument()

		// Workspace files limit
		const workspaceFilesSlider = screen.getByTestId("workspace-files-limit-slider")
		expect(workspaceFilesSlider).toBeInTheDocument()

		// Show .rooignore'd files
		const showRooIgnoredFilesCheckbox = screen.getByTestId("show-rooignored-files-checkbox")
		expect(showRooIgnoredFilesCheckbox).toBeInTheDocument()
		expect(screen.getByTestId("show-rooignored-files-checkbox")).not.toBeChecked()

		// Synthesization controls (Added)
		expect(screen.getByTestId("enable-context-synthesization-checkbox")).toBeInTheDocument()
		expect(screen.getByTestId("context-synthesization-trigger-threshold-input")).toBeInTheDocument()
		expect(screen.getByTestId("context-synthesization-initial-turns-input")).toBeInTheDocument()
		expect(screen.getByTestId("context-synthesization-recent-turns-input")).toBeInTheDocument()

		// Check initial disabled state for sub-settings (Added)
		expect(screen.getByTestId("context-synthesization-trigger-threshold-input")).toBeDisabled()
		expect(screen.getByTestId("context-synthesization-initial-turns-input")).toBeDisabled()
		expect(screen.getByTestId("context-synthesization-recent-turns-input")).toBeDisabled()
	})

	it("updates open tabs context limit", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		const slider = screen.getByTestId("open-tabs-limit-slider")
		fireEvent.change(slider, { target: { value: "50" } })

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("maxOpenTabsContext", 50)
	})

	it("updates workspace files contextlimit", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		const slider = screen.getByTestId("workspace-files-limit-slider")
		fireEvent.change(slider, { target: { value: "50" } })

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("maxWorkspaceFiles", 50)
	})

	it("updates show rooignored files setting", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		const checkbox = screen.getByTestId("show-rooignored-files-checkbox")
		fireEvent.click(checkbox)

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("showRooIgnoredFiles", true)
	})

	// --- Tests for new synthesization settings --- (Added)

	it("enables sub-settings when synthesization is enabled", () => {
		render(<ContextManagementSettings {...defaultProps} enableContextSummarization={true} />)

		expect(screen.getByTestId("context-synthesization-trigger-threshold-input")).not.toBeDisabled()
		expect(screen.getByTestId("context-synthesization-initial-turns-input")).not.toBeDisabled()
		expect(screen.getByTestId("context-synthesization-recent-turns-input")).not.toBeDisabled()
	})

	it("updates enable context synthesization setting", () => {
		render(<ContextManagementSettings {...defaultProps} />)
		const checkbox = screen.getByTestId("enable-context-synthesization-checkbox")
		fireEvent.click(checkbox)
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("enableContextSummarization", true)
	})

	it("updates synthesization trigger threshold", () => {
		render(<ContextManagementSettings {...defaultProps} enableContextSummarization={true} />) // Enable first
		const input = screen.getByTestId("context-synthesization-trigger-threshold-input")
		fireEvent.change(input, { target: { value: "95" } })
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("contextSummarizationTriggerThreshold", 95)
	})

	it("updates initial turns to keep", () => {
		render(<ContextManagementSettings {...defaultProps} enableContextSummarization={true} />) // Enable first
		const input = screen.getByTestId("context-synthesization-initial-turns-input")
		fireEvent.change(input, { target: { value: "3" } })
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("contextSummarizationInitialStaticTurns", 3)
	})

	it("updates recent turns to keep", () => {
		render(<ContextManagementSettings {...defaultProps} enableContextSummarization={true} />) // Enable first
		const input = screen.getByTestId("context-synthesization-recent-turns-input")
		fireEvent.change(input, { target: { value: "12" } })
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("contextSummarizationRecentTurns", 12)
	})
})
