// npx vitest src/components/settings/__tests__/ContextManagementSettings.spec.tsx

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { ContextManagementSettings } from "../ContextManagementSettings"

// Mock the translation hook
vi.mock("@/hooks/useAppTranslation", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			// Return specific translations for our test cases
			if (key === "settings:contextManagement.diagnostics.maxMessages.unlimitedLabel") {
				return "Unlimited"
			}
			return key
		},
	}),
}))

// Mock the UI components
vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId, disabled }: any) => (
		<input
			type="range"
			value={value?.[0] ?? 0}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
			disabled={disabled}
			role="slider"
		/>
	),
	Input: ({ value, onChange, "data-testid": dataTestId, ...props }: any) => (
		<input value={value} onChange={onChange} data-testid={dataTestId} {...props} />
	),
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
	Select: ({ children, ...props }: any) => <div {...props}>{children}</div>,
	SelectTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
	SelectValue: ({ children, ...props }: any) => <div {...props}>{children}</div>,
	SelectContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
	SelectItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

// Mock vscode utilities - this is necessary since we're not in a VSCode environment

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock VSCode components to behave like standard HTML elements
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ checked, onChange, children, "data-testid": dataTestId, ...props }: any) => (
		<label data-testid={dataTestId} {...props}>
			<input
				type="checkbox"
				role="checkbox"
				checked={checked || false}
				aria-checked={checked || false}
				onChange={(e: any) => onChange?.({ target: { checked: e.target.checked } })}
			/>
			{children}
		</label>
	),
	VSCodeTextArea: ({ value, onChange, ...props }: any) => <textarea value={value} onChange={onChange} {...props} />,
}))

describe("ContextManagementSettings", () => {
	const defaultProps = {
		autoCondenseContext: false,
		autoCondenseContextPercent: 80,
		condensingApiConfigId: undefined,
		customCondensingPrompt: undefined,
		listApiConfigMeta: [],
		maxOpenTabsContext: 20,
		maxWorkspaceFiles: 200,
		showRooIgnoredFiles: false,
		maxReadFileLine: -1,
		maxConcurrentFileReads: 5,
		profileThresholds: {},
		includeDiagnosticMessages: true,
		maxDiagnosticMessages: 50,
		setCachedStateField: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders diagnostic settings", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		// Check for diagnostic checkbox
		expect(screen.getByTestId("include-diagnostic-messages-checkbox")).toBeInTheDocument()

		// Check for slider
		expect(screen.getByTestId("max-diagnostic-messages-slider")).toBeInTheDocument()
		expect(screen.getByText("50")).toBeInTheDocument()
	})

	it("renders with diagnostic messages enabled", () => {
		render(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={true} />)

		const checkbox = screen.getByTestId("include-diagnostic-messages-checkbox")
		expect(checkbox.querySelector("input")).toBeChecked()

		const slider = screen.getByTestId("max-diagnostic-messages-slider")
		expect(slider).toBeInTheDocument()
		expect(slider).toHaveValue("50")
	})

	it("renders with diagnostic messages disabled", () => {
		render(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={false} />)

		const checkbox = screen.getByTestId("include-diagnostic-messages-checkbox")
		expect(checkbox.querySelector("input")).not.toBeChecked()

		// Slider should still be rendered when diagnostics are disabled
		expect(screen.getByTestId("max-diagnostic-messages-slider")).toBeInTheDocument()
		expect(screen.getByText("50")).toBeInTheDocument()
	})

	it("calls setCachedStateField when include diagnostic messages checkbox is toggled", async () => {
		const setCachedStateField = vi.fn()
		render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

		const checkbox = screen.getByTestId("include-diagnostic-messages-checkbox").querySelector("input")!
		fireEvent.click(checkbox)

		await waitFor(() => {
			expect(setCachedStateField).toHaveBeenCalledWith("includeDiagnosticMessages", false)
		})
	})

	it("calls setCachedStateField when max diagnostic messages slider is changed", async () => {
		const setCachedStateField = vi.fn()
		render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

		const slider = screen.getByTestId("max-diagnostic-messages-slider")
		fireEvent.change(slider, { target: { value: "100" } })

		await waitFor(() => {
			expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", -1)
		})
	})

	it("keeps slider visible when include diagnostic messages is unchecked", () => {
		const { rerender } = render(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={true} />)

		const slider = screen.getByTestId("max-diagnostic-messages-slider")
		expect(slider).toBeInTheDocument()

		// Update to disabled - slider should still be visible
		rerender(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={false} />)
		expect(screen.getByTestId("max-diagnostic-messages-slider")).toBeInTheDocument()
	})

	it("displays correct max diagnostic messages value", () => {
		const { rerender } = render(<ContextManagementSettings {...defaultProps} maxDiagnosticMessages={25} />)

		expect(screen.getByText("25")).toBeInTheDocument()

		// Update value - 100 should display as "Unlimited"
		rerender(<ContextManagementSettings {...defaultProps} maxDiagnosticMessages={100} />)
		expect(
			screen.getByText("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel"),
		).toBeInTheDocument()

		// Test unlimited value (-1) displays as "Unlimited"
		rerender(<ContextManagementSettings {...defaultProps} maxDiagnosticMessages={-1} />)
		expect(
			screen.getByText("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel"),
		).toBeInTheDocument()
	})

	it("renders other context management settings", () => {
		render(<ContextManagementSettings {...defaultProps} />)

		// Check for other sliders
		expect(screen.getByTestId("open-tabs-limit-slider")).toBeInTheDocument()
		expect(screen.getByTestId("workspace-files-limit-slider")).toBeInTheDocument()
		expect(screen.getByTestId("max-concurrent-file-reads-slider")).toBeInTheDocument()

		// Check for checkboxes
		expect(screen.getByTestId("show-rooignored-files-checkbox")).toBeInTheDocument()
		expect(screen.getByTestId("auto-condense-context-checkbox")).toBeInTheDocument()
	})

	describe("Edge cases for maxDiagnosticMessages", () => {
		it("handles zero value as unlimited", async () => {
			const setCachedStateField = vi.fn()
			render(
				<ContextManagementSettings
					{...defaultProps}
					maxDiagnosticMessages={0}
					setCachedStateField={setCachedStateField}
				/>,
			)

			// Zero is now treated as unlimited
			expect(
				screen.getByText("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel"),
			).toBeInTheDocument()

			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			// Zero should map to slider position 100 (unlimited)
			expect(slider).toHaveValue("100")
		})

		it("handles negative values as unlimited", async () => {
			const setCachedStateField = vi.fn()
			render(
				<ContextManagementSettings
					{...defaultProps}
					maxDiagnosticMessages={-10}
					setCachedStateField={setCachedStateField}
				/>,
			)

			// Component displays "Unlimited" for any negative value
			expect(
				screen.getByText("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel"),
			).toBeInTheDocument()

			// Slider should be at max position (100) for negative values
			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			expect(slider).toHaveValue("100")
		})

		it("handles very large numbers by capping at maximum", async () => {
			const setCachedStateField = vi.fn()
			const largeNumber = 1000
			render(
				<ContextManagementSettings
					{...defaultProps}
					maxDiagnosticMessages={largeNumber}
					setCachedStateField={setCachedStateField}
				/>,
			)

			// Should display the actual value even if it exceeds slider max
			expect(screen.getByText(largeNumber.toString())).toBeInTheDocument()

			// Slider value would be capped at max (100)
			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			expect(slider).toHaveValue("100")
		})

		it("enforces maximum value constraint", async () => {
			const setCachedStateField = vi.fn()
			render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

			const slider = screen.getByTestId("max-diagnostic-messages-slider")

			// Test that setting value above 100 gets capped
			fireEvent.change(slider, { target: { value: "150" } })

			await waitFor(() => {
				// Should be capped at 100, which maps to -1 (unlimited)
				expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", -1)
			})
		})

		it("handles boundary value at minimum (1)", async () => {
			const setCachedStateField = vi.fn()
			render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			fireEvent.change(slider, { target: { value: "1" } })

			await waitFor(() => {
				expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", 1)
			})
		})

		it("handles boundary value at maximum (100) as unlimited (-1)", async () => {
			const setCachedStateField = vi.fn()
			render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			fireEvent.change(slider, { target: { value: "100" } })

			await waitFor(() => {
				// When slider is at 100, it should set the value to -1 (unlimited)
				expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", -1)
			})
		})

		it("handles decimal values by parsing as float", async () => {
			const setCachedStateField = vi.fn()
			render(<ContextManagementSettings {...defaultProps} setCachedStateField={setCachedStateField} />)

			const slider = screen.getByTestId("max-diagnostic-messages-slider")
			fireEvent.change(slider, { target: { value: "50.7" } })

			await waitFor(() => {
				// The mock slider component parses as float
				expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", 50.7)
			})
		})
	})
})
