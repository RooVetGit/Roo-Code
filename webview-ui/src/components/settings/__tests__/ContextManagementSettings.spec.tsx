// npx vitest src/components/settings/__tests__/ContextManagementSettings.spec.tsx

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { ContextManagementSettings } from "../ContextManagementSettings"

// Mock the UI components
vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId, disabled }: any) => (
		<input
			type="range"
			value={value[0]}
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

		// Slider should not be rendered when diagnostics are disabled
		expect(screen.queryByTestId("max-diagnostic-messages-slider")).not.toBeInTheDocument()
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
			expect(setCachedStateField).toHaveBeenCalledWith("maxDiagnosticMessages", 100)
		})
	})

	it("hides slider when include diagnostic messages is unchecked", () => {
		const { rerender } = render(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={true} />)

		const slider = screen.getByTestId("max-diagnostic-messages-slider")
		expect(slider).toBeInTheDocument()

		// Update to disabled
		rerender(<ContextManagementSettings {...defaultProps} includeDiagnosticMessages={false} />)
		expect(screen.queryByTestId("max-diagnostic-messages-slider")).not.toBeInTheDocument()
	})

	it("displays correct max diagnostic messages value", () => {
		const { rerender } = render(<ContextManagementSettings {...defaultProps} maxDiagnosticMessages={25} />)

		expect(screen.getByText("25")).toBeInTheDocument()

		// Update value
		rerender(<ContextManagementSettings {...defaultProps} maxDiagnosticMessages={100} />)
		expect(screen.getByText("100")).toBeInTheDocument()
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
})
