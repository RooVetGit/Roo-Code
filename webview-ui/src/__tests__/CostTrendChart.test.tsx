/**
 * CostTrendChart.test.tsx
 *
 * Comprehensive test suite for the CostTrendChart component covering:
 * 1. Data transformation - Tests how the component processes and displays different data formats
 * 2. Resizing behavior - Tests the component's response to window resize events
 * 3. Hover behavior - Tests the onHoverChange callback functionality
 * 4. Additional aspects - Axis configuration, click handling, theme integration, chart synchronization
 *
 * The tests use extensive mocking of the uPlot library and browser APIs to isolate the component's behavior.
 */

import React from "react"
import { render, screen, act, waitFor } from "@testing-library/react" // Removed unused cleanup import
import "@testing-library/jest-dom"
// Removed unused uPlot import
import CostTrendChart from "../components/chat/CostTrendChart"
import { formatLargeNumber } from "@src/utils/format"

// Define these within the mock factory or reset them in beforeEach
let mockUPlotInstance: any = null
let lastUPlotOptions: any = null
let lastUPlotData: any = null

// Define the mock directly inside jest.mock
let mockUPlotConstructor: jest.Mock // Declare in outer scope
jest.mock("uplot", () => {
	// Define the mock constructor function inside the factory
	mockUPlotConstructor = jest.fn().mockImplementation((options, data) => {
		// Assign in factory
		lastUPlotOptions = options
		lastUPlotData = data
		mockUPlotInstance = {
			destroy: jest.fn(),
			setSize: jest.fn(),
			cursor: { idx: null },
			hooks: {
				setCursor: options.hooks?.setCursor || [],
				draw: options.hooks?.draw || [],
				init: options.hooks?.init || [],
				destroy: options.hooks?.destroy || [],
			},
			over: document.createElement("div"),
			data: data,
			bbox: { left: 0, top: 0, width: 400, height: 200 },
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				strokeStyle: "",
				lineWidth: 1,
				strokeRect: jest.fn(),
			},
		}

		// Initialize plugins if provided
		if (options.plugins) {
			options.plugins.forEach((plugin: any) => {
				if (plugin.hooks?.init) {
					plugin.hooks.init(mockUPlotInstance)
				}
			})
		}
		return mockUPlotInstance
	})

	// Return the mock structure
	return {
		__esModule: true, // Keep this for ESM interop consistency
		default: mockUPlotConstructor, // Use the outer scope variable
		sync: jest.fn(() => ({ key: "mock-sync-key", sub: jest.fn(), unsub: jest.fn(), pub: jest.fn() })),
	}
})

// Define the mock property getter function separately
const mockGetPropertyValue = jest.fn((prop: string) => {
	switch (prop) {
		case "--vscode-foreground":
			return "#cccccc"
		case "--vscode-button-foreground":
			return "#ffffff"
		case "--vscode-editor-background":
			return "#1e1e1e"
		case "--vscode-editorGroupHeader-tabsBorder":
			return "#555555"
		case "--vscode-editor-selectionBackground":
			return "rgba(255, 255, 255, 0.2)"
		case "--vscode-editorWidget-background":
			return "#252526"
		case "--vscode-editorWidget-border":
			return "#454545"
		case "--vscode-descriptionForeground":
			return "#8b949e"
		case "--vscode-font-size":
			return "13px"
		case "--vscode-font-family":
			return "sans-serif"
		default:
			return ""
	}
})

// Mock getComputedStyle to return an object containing the mock property getter
const mockGetComputedStyle = jest.fn().mockImplementation(() => ({
	getPropertyValue: mockGetPropertyValue,
}))
Object.defineProperty(window, "getComputedStyle", { value: mockGetComputedStyle })
Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true })

global.ResizeObserver = jest.fn().mockImplementation(() => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
}))

global.MutationObserver = jest.fn().mockImplementation(() => ({
	observe: jest.fn(),
	disconnect: jest.fn(),
	takeRecords: jest.fn(() => []),
}))

jest.mock("@src/utils/format", () => ({
	formatLargeNumber: jest.fn((num) => num.toLocaleString()),
}))

describe("<CostTrendChart />", () => {
	const mockOnHoverChange = jest.fn()
	const mockOnClick = jest.fn()
	const defaultData: [number[], number[]] = [
		[1, 2, 3],
		[10, 20, 15],
	]

	beforeEach(() => {
		// Reset mocks and tracking variables before each test
		// Rely on Testing Library's automatic cleanup instead of manual cleanup()
		jest.clearAllMocks()
		mockUPlotInstance = null
		lastUPlotOptions = null
		lastUPlotData = null
	})

	// Remove manual afterEach cleanup

	const renderChart = (props = {}) => {
		const combinedProps = {
			chartData: defaultData,
			onHoverChange: mockOnHoverChange,
			onClick: mockOnClick,
			...props,
		}
		// Return the unmount function from render
		return render(<CostTrendChart {...combinedProps} />)
	}

	it("should render without crashing", () => {
		renderChart()
		expect(screen.getByTestId("cost-trend-chart-container")).toBeInTheDocument()
	})

	it('should display "No API requests made yet" message when chartData is empty or invalid', () => {
		let renderResult = renderChart({ chartData: undefined })
		expect(screen.getByText(/No API requests made yet/i)).toBeInTheDocument()
		renderResult.unmount() // Unmount after assertion

		renderResult = renderChart({ chartData: [[], []] })
		expect(screen.getByText(/No API requests made yet/i)).toBeInTheDocument()
		renderResult.unmount() // Unmount after assertion

		renderResult = renderChart({ chartData: [undefined, undefined] })
		expect(screen.getByText(/No API requests made yet/i)).toBeInTheDocument()
		renderResult.unmount() // Unmount after assertion
	})

	it("should initialize uPlot with correct data and basic options", () => {
		renderChart()
		// Expect constructor to be called twice due to initial render + style effect update
		expect(mockUPlotConstructor).toHaveBeenCalledTimes(2)
		expect(lastUPlotData).toEqual(defaultData)
		expect(lastUPlotOptions).toBeDefined()
		expect(lastUPlotOptions.series).toHaveLength(2)
		expect(lastUPlotOptions.series[1].label).toBe("Value")
		expect(lastUPlotOptions.scales.$).toBeDefined()
	})

	it("should pass custom label, height, and unit to uPlot options", () => {
		renderChart({ chartLabel: "Test Label", height: 250, yAxisUnit: "Tokens" })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(lastUPlotOptions.series[1].label).toBe("Test Label")
		expect(lastUPlotOptions.height).toBe(250)

		const yAxisFormatter = lastUPlotOptions.axes[1].values
		expect(yAxisFormatter).toBeDefined()
		const formattedValues = yAxisFormatter(mockUPlotInstance, [1000, 2000])

		expect(formatLargeNumber).toHaveBeenCalledWith(1000)
		expect(formatLargeNumber).toHaveBeenCalledWith(2000)
		expect(formattedValues[0]).not.toContain("$")
	})

	it('should handle currency formatting for Y-axis when unit is "$"', () => {
		renderChart({ yAxisUnit: "$" })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		const yAxisFormatter = lastUPlotOptions.axes[1].values
		expect(yAxisFormatter).toBeDefined()
		const formattedValues = yAxisFormatter(mockUPlotInstance, [0.005, 10.5, 20])
		expect(formattedValues[0]).toBe("$0.01")
		expect(formattedValues[1]).toBe("$10.50")
		expect(formattedValues[2]).toBe("$20.00")
		expect(formatLargeNumber).not.toHaveBeenCalled()
	})

	it("should handle single data point correctly (show points only)", () => {
		renderChart({ chartData: [[1], [50]] })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(lastUPlotOptions.series[1].width).toBe(0)
		expect(lastUPlotOptions.series[1].points.show).toBe(true)
	})

	it("should handle multiple data points correctly (show line)", () => {
		renderChart({
			chartData: [
				[1, 2],
				[50, 60],
			],
		})
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(lastUPlotOptions.series[1].width).toBeGreaterThan(0)
		expect(lastUPlotOptions.series[1].points.show).toBe(false)
	})

	it("should destroy and recreate uPlot instance when data changes", () => {
		const { rerender } = renderChart()
		// Initial render causes 2 calls
		expect(mockUPlotConstructor).toHaveBeenCalledTimes(2)
		const firstInstance = mockUPlotInstance
		mockUPlotConstructor.mockClear() // Clear calls before rerender

		const newData: [number[], number[]] = [
			[4, 5, 6],
			[30, 40, 35],
		]
		act(() => {
			rerender(<CostTrendChart chartData={newData} onHoverChange={mockOnHoverChange} onClick={mockOnClick} />)
		})

		expect(firstInstance.destroy).toHaveBeenCalledTimes(1)
		// Rerender with new data should cause 1 more call (only chart effect runs as styles don't change)
		expect(mockUPlotConstructor).toHaveBeenCalledTimes(1)
		expect(lastUPlotData).toEqual(newData)
	})

	it("should destroy uPlot instance when data becomes empty", () => {
		const { rerender } = renderChart()
		// Initial render causes 2 calls
		expect(mockUPlotConstructor).toHaveBeenCalledTimes(2)
		const instance = mockUPlotInstance

		act(() => {
			rerender(<CostTrendChart chartData={[[], []]} onHoverChange={mockOnHoverChange} onClick={mockOnClick} />)
		})

		expect(instance.destroy).toHaveBeenCalledTimes(1)
		expect(screen.getByText(/No API requests made yet/i)).toBeInTheDocument()
	})

	it("should show/hide X-axis based on showXAxis prop", () => {
		renderChart({ showXAxis: true })
		expect(lastUPlotOptions.axes[0].show).toBe(true)
		expect(lastUPlotOptions.axes[0].size).toBeGreaterThan(0)

		renderChart({ showXAxis: false })
		expect(lastUPlotOptions.axes[0].show).toBe(false)
		expect(lastUPlotOptions.axes[0].size).toBe(0)
	})

	it("should show/hide Y-axis based on showYAxis prop", () => {
		renderChart({ showYAxis: true })
		expect(lastUPlotOptions.axes[1].show).toBe(true)
		expect(lastUPlotOptions.axes[1].size).toBeGreaterThan(0)

		renderChart({ showYAxis: false })
		expect(lastUPlotOptions.axes[1].show).toBe(false)
		expect(lastUPlotOptions.axes[1].size).toBe(0)
	})

	it("should position Y-axis based on yAxisSide prop", () => {
		renderChart({ yAxisSide: "left" })
		expect(lastUPlotOptions.axes[1].side).toBe(3)

		renderChart({ yAxisSide: "right" })
		expect(lastUPlotOptions.axes[1].side).toBe(1)
	})

	it("should hide zero on Y-axis if hideYAxisZero is true", () => {
		renderChart({ hideYAxisZero: true, yAxisUnit: "$" })
		const yAxisFormatter = lastUPlotOptions.axes[1].values
		const formattedValues = yAxisFormatter(mockUPlotInstance, [0, 10, 20])
		expect(formattedValues[0]).toBe("")
		expect(formattedValues[1]).toBe("$10.00")
	})

	it("should show/hide grid lines based on showGridLines prop", () => {
		renderChart({ showGridLines: true })
		expect(lastUPlotOptions.axes[0].grid.show).toBe(true)
		expect(lastUPlotOptions.axes[1].grid.show).toBe(true)

		renderChart({ showGridLines: false })
		expect(lastUPlotOptions.axes[0].grid.show).toBe(false)
		expect(lastUPlotOptions.axes[1].grid.show).toBe(false)
		expect(lastUPlotOptions.hooks.draw).toBeDefined()
		expect(lastUPlotOptions.hooks.draw.length).toBeGreaterThan(0)
	})

	it("should apply custom padding", () => {
		const customPadding: [number, number, number, number] = [5, 10, 15, 20]
		renderChart({ padding: customPadding, yAxisSide: "left" })
		expect(lastUPlotOptions.padding).toEqual(customPadding)

		renderChart({ padding: customPadding, yAxisSide: "right" })
		expect(lastUPlotOptions.padding).toEqual([5, 0, 15, 20])
	})

	it("should call onHoverChange when uPlot cursor changes", () => {
		renderChart()
		expect(mockUPlotConstructor).toHaveBeenCalled()

		const setCursorHook = lastUPlotOptions.hooks.setCursor?.[0]
		expect(setCursorHook).toBeDefined()

		act(() => {
			mockUPlotInstance.cursor.idx = 1
			mockUPlotInstance.data = defaultData
			setCursorHook(mockUPlotInstance)
		})

		expect(mockOnHoverChange).toHaveBeenCalledTimes(1)
		expect(mockOnHoverChange).toHaveBeenCalledWith({
			isHovering: true,
			index: defaultData[0][1],
			yValue: defaultData[1][1],
		})

		act(() => {
			mockUPlotInstance.cursor.idx = null
			setCursorHook(mockUPlotInstance)
		})

		expect(mockOnHoverChange).toHaveBeenCalledTimes(2)
		expect(mockOnHoverChange).toHaveBeenLastCalledWith({ isHovering: false })
	})

	it("should call onClick when the chart overlay is clicked", () => {
		renderChart()
		expect(mockUPlotConstructor).toHaveBeenCalled()

		const clickPlugin = lastUPlotOptions.plugins?.[0]
		expect(clickPlugin).toBeDefined()
		expect(clickPlugin.hooks?.init).toBeDefined()

		let capturedClickListener: Function | null = null
		mockUPlotInstance.over.addEventListener = jest.fn((event, listener, options) => {
			if (event === "click" && options?.capture === true) {
				capturedClickListener = listener
			}
		})

		clickPlugin.hooks.init(mockUPlotInstance)

		expect(mockUPlotInstance.over.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), {
			capture: true,
		})
		expect(capturedClickListener).toBeDefined()

		const mockClickEvent = new MouseEvent("click", { bubbles: true, detail: 1 })
		Object.defineProperty(mockClickEvent, "stopImmediatePropagation", { value: jest.fn() })

		if (capturedClickListener) {
			;(capturedClickListener as Function)(mockClickEvent)
		}

		expect(mockOnClick).toHaveBeenCalledTimes(1)
		expect(mockOnClick).toHaveBeenCalledWith(mockClickEvent)
		expect(mockClickEvent.stopImmediatePropagation).toHaveBeenCalled()
	})

	it("should NOT attach click listener if onClick prop is not provided", () => {
		renderChart({ onClick: undefined })
		expect(mockUPlotConstructor).toHaveBeenCalled()

		const clickPlugin = lastUPlotOptions.plugins?.[0]
		expect(clickPlugin).toBeDefined()

		mockUPlotInstance.over.addEventListener = jest.fn()

		clickPlugin.hooks.init(mockUPlotInstance)

		expect(mockUPlotInstance.over.addEventListener).not.toHaveBeenCalled()
	})

	it("should call uPlot setSize on window resize", async () => {
		renderChart()
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(mockUPlotInstance.setSize).toHaveBeenCalled()

		mockUPlotInstance.setSize.mockClear()

		act(() => {
			global.dispatchEvent(new Event("resize"))
		})

		await waitFor(() => {
			expect(mockUPlotInstance.setSize).toHaveBeenCalledTimes(1)
			expect(mockUPlotInstance.setSize).toHaveBeenCalledWith({
				width: expect.any(Number),
				height: lastUPlotOptions.height,
			})
		})
	})

	it("should attempt to read CSS variables on mount", () => {
		renderChart()
		expect(mockGetComputedStyle).toHaveBeenCalled()
		// Assert against the stable mock function reference
		expect(mockGetPropertyValue).toHaveBeenCalledWith("--vscode-foreground")
		expect(mockGetPropertyValue).toHaveBeenCalledWith("--vscode-button-foreground")
		expect(mockGetPropertyValue).toHaveBeenCalledWith("--vscode-editor-background")
	})

	it("should set up MutationObserver to watch for theme changes", () => {
		const mockObserve = jest.fn()
		global.MutationObserver = jest.fn().mockImplementation(() => ({
			observe: mockObserve,
			disconnect: jest.fn(),
			takeRecords: jest.fn(() => []),
		})) as any

		renderChart()

		expect(global.MutationObserver).toHaveBeenCalledTimes(1)
		expect(mockObserve).toHaveBeenCalledWith(document.body, { attributes: true, attributeFilter: ["class"] })
	})

	it('should configure uPlot sync with GRID_SYNC key when syncKey is "grid"', () => {
		renderChart({ syncKey: "grid" })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		// Check that the options passed to uPlot constructor use the key from the mocked sync function
		expect(lastUPlotOptions.cursor.sync.key).toBe("mock-sync-key")
	})

	it("should configure uPlot sync with custom key when syncKey is provided", () => {
		renderChart({ syncKey: "custom-sync" })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(lastUPlotOptions.cursor.sync.key).toBe("custom-sync")
	})

	it("should disable sync when syncKey is not provided", () => {
		renderChart({ syncKey: undefined })
		expect(mockUPlotConstructor).toHaveBeenCalled()
		expect(lastUPlotOptions.cursor.sync.key).toBe("no-sync")
	})
})
