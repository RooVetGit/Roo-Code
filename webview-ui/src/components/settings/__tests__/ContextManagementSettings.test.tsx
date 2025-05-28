// npx jest src/components/settings/__tests__/ContextManagementSettings.test.ts

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import { ContextManagementSettings } from "@src/components/settings/ContextManagementSettings"

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

// Mock lucide-react icons - these don't work well in Jest/JSDOM environment
jest.mock("lucide-react", () => {
	return {
		Database: React.forwardRef((props: any, ref: any) => <div ref={ref} data-testid="database-icon" {...props} />),
		ChevronDown: React.forwardRef((props: any, ref: any) => (
			<div ref={ref} data-testid="chevron-down-icon" {...props} />
		)),
		ChevronUp: React.forwardRef((props: any, ref: any) => (
			<div ref={ref} data-testid="chevron-up-icon" {...props} />
		)),
		Check: React.forwardRef((props: any, ref: any) => <div ref={ref} data-testid="check-icon" {...props} />),
	}
})

// Mock translation hook to return the key as the translation
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock vscode utilities - this is necessary since we're not in a VSCode environment
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

describe("ContextManagementSettings", () => {
	const defaultProps = {
		autoCondenseContext: true,
		autoCondenseContextPercent: 100,
		listApiConfigMeta: [],
		maxOpenTabsContext: 20,
		maxWorkspaceFiles: 200,
		showRooIgnoredFiles: false,
		setCachedStateField: jest.fn(),
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
	})

	it("updates open tabs context limit", () => {
		const mockSetCachedStateField = jest.fn()
		const props = { ...defaultProps, setCachedStateField: mockSetCachedStateField }
		render(<ContextManagementSettings {...props} />)

		const slider = screen.getByTestId("open-tabs-limit-slider")
		expect(slider).toBeInTheDocument()

		// Check that the current value is displayed
		expect(screen.getByText("20")).toBeInTheDocument()

		// Test slider interaction using keyboard events (ArrowRight increases value)
		slider.focus()
		fireEvent.keyDown(slider, { key: "ArrowRight" })

		// The callback should have been called with the new value (20 + 1 = 21)
		expect(mockSetCachedStateField).toHaveBeenCalledWith("maxOpenTabsContext", 21)
	})

	it("updates workspace files limit", () => {
		const mockSetCachedStateField = jest.fn()
		const props = { ...defaultProps, setCachedStateField: mockSetCachedStateField }
		render(<ContextManagementSettings {...props} />)

		const slider = screen.getByTestId("workspace-files-limit-slider")
		expect(slider).toBeInTheDocument()

		// Check that the current value is displayed
		expect(screen.getByText("200")).toBeInTheDocument()

		// Test slider interaction using keyboard events (ArrowRight increases value)
		slider.focus()
		fireEvent.keyDown(slider, { key: "ArrowRight" })

		// The callback should have been called with the new value (200 + 1 = 201)
		expect(mockSetCachedStateField).toHaveBeenCalledWith("maxWorkspaceFiles", 201)
	})

	it("updates show rooignored files setting", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		const checkbox = screen.getByTestId("show-rooignored-files-checkbox")
		fireEvent.click(checkbox)

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("showRooIgnoredFiles", true)
	})

	it("renders max read file line controls", () => {
		const propsWithMaxReadFileLine = {
			...defaultProps,
			maxReadFileLine: 500,
		}
		render(<ContextManagementSettings {...propsWithMaxReadFileLine} />)

		// Max read file line input
		const maxReadFileInput = screen.getByTestId("max-read-file-line-input")
		expect(maxReadFileInput).toBeInTheDocument()
		expect(maxReadFileInput).toHaveValue(500)

		// Always full read checkbox
		const alwaysFullReadCheckbox = screen.getByTestId("max-read-file-always-full-checkbox")
		expect(alwaysFullReadCheckbox).toBeInTheDocument()
		expect(alwaysFullReadCheckbox).not.toBeChecked()
	})

	it("updates max read file line setting", () => {
		const propsWithMaxReadFileLine = {
			...defaultProps,
			maxReadFileLine: 500,
		}
		render(<ContextManagementSettings {...propsWithMaxReadFileLine} />)

		const input = screen.getByTestId("max-read-file-line-input")
		fireEvent.change(input, { target: { value: "1000" } })

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("maxReadFileLine", 1000)
	})

	it("toggles always full read setting", () => {
		const propsWithMaxReadFileLine = {
			...defaultProps,
			maxReadFileLine: 500,
		}
		render(<ContextManagementSettings {...propsWithMaxReadFileLine} />)

		const checkbox = screen.getByTestId("max-read-file-always-full-checkbox")
		fireEvent.click(checkbox)

		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("maxReadFileLine", -1)
	})

	it("renders with autoCondenseContext enabled", () => {
		const propsWithAutoCondense = {
			...defaultProps,
			autoCondenseContext: true,
			autoCondenseContextPercent: 75,
			condensingApiConfigId: "test-config",
			customCondensingPrompt: "Test prompt",
		}
		render(<ContextManagementSettings {...propsWithAutoCondense} />)

		// Should render the auto condense section
		expect(screen.getByText("settings:experimental.autoCondenseContextPercent.label")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.condensingApiConfiguration.label")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.customCondensingPrompt.label")).toBeInTheDocument()
	})
})
