import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import SettingsView from "../SettingsView"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock ApiConfigManager
vi.mock("../ApiConfigManager", () => ({
	__esModule: true,
	default: ({ currentApiConfigName }: any) => (
		<div data-testid="api-config-management">
			<span>Current config: {currentApiConfigName}</span>
		</div>
	),
}))

// Mock VSCode UI toolkit components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, appearance, "data-testid": dataTestId }: any) =>
		appearance === "icon" ? (
			<button
				onClick={onClick}
				className="codicon codicon-close"
				aria-label="Remove command"
				data-testid={dataTestId}>
				<span className="codicon codicon-close" />
			</button>
		) : (
			<button onClick={onClick} data-appearance={appearance} data-testid={dataTestId}>
				{children}
			</button>
		),
	VSCodeCheckbox: ({ children, onChange, checked, "data-testid": dataTestId }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange({ target: { checked: e.target.checked } })}
				aria-label={typeof children === "string" ? children : undefined}
				data-testid={dataTestId}
			/>
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, placeholder, "data-testid": dataTestId }: any) => (
		<input
			type="text"
			value={value}
			onChange={(e) => onInput({ target: { value: e.target.value } })}
			placeholder={placeholder}
			data-testid={dataTestId}
		/>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href || "#"}>{children}</a>,
	VSCodeRadio: ({ value, checked, onChange }: any) => (
		<input type="radio" value={value} checked={checked} onChange={onChange} />
	),
	VSCodeRadioGroup: ({ children, onChange }: any) => <div onChange={onChange}>{children}</div>,
}))

// Mock Tab components
vi.mock("../../../components/common/Tab", () => ({
	...vi.importActual("../../../components/common/Tab"),
	Tab: ({ children }: any) => <div data-testid="tab-container">{children}</div>,
	TabHeader: ({ children }: any) => <div data-testid="tab-header">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
	TabList: ({ children, value, onValueChange, "data-testid": dataTestId }: any) => {
		// Store onValueChange in a global variable so TabTrigger can access it
		;(window as any).__onValueChange = onValueChange
		return (
			<div data-testid={dataTestId} data-value={value}>
				{children}
			</div>
		)
	},
	TabTrigger: ({ children, value, "data-testid": dataTestId, onClick, isSelected }: any) => {
		// This function simulates clicking on a tab and making its content visible
		const handleClick = () => {
			if (onClick) onClick()
			// Access onValueChange from the global variable
			const onValueChange = (window as any).__onValueChange
			if (onValueChange) onValueChange(value)
			// Make all tab contents invisible
			document.querySelectorAll("[data-tab-content]").forEach((el) => {
				;(el as HTMLElement).style.display = "none"
			})
			// Make this tab's content visible
			const tabContent = document.querySelector(`[data-tab-content="${value}"]`)
			if (tabContent) {
				;(tabContent as HTMLElement).style.display = "block"
			}
		}

		return (
			<button data-testid={dataTestId} data-value={value} data-selected={isSelected} onClick={handleClick}>
				{children}
			</button>
		)
	},
}))

// Mock UI components
vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
		/>
	),
	Button: ({ children, onClick, variant, className, "data-testid": dataTestId }: any) => (
		<button onClick={onClick} data-variant={variant} className={className} data-testid={dataTestId}>
			{children}
		</button>
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
	TooltipProvider: ({ children }: any) => <>{children}</>,
	Input: ({ value, onChange, placeholder, "data-testid": dataTestId }: any) => (
		<input type="text" value={value} onChange={onChange} placeholder={placeholder} data-testid={dataTestId} />
	),
	Select: ({ children, value, onValueChange }: any) => (
		<div data-testid="select" data-value={value}>
			<button onClick={() => onValueChange && onValueChange("test-change")}>{value}</button>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectGroup: ({ children }: any) => <div data-testid="select-group">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<div data-testid={`select-item-${value}`} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
	AlertDialog: ({ children, open }: any) => (
		<div data-testid="alert-dialog" data-open={open}>
			{children}
		</div>
	),
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogAction: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-cancel" onClick={onClick}>
			{children}
		</button>
	),
}))

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				ttsEnabled: false,
				ttsSpeed: 1,
				soundEnabled: false,
				soundVolume: 0.5,
				...state,
			},
		},
		"*",
	)
}

const renderSettingsView = () => {
	const onDone = vi.fn()
	const queryClient = new QueryClient()

	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<SettingsView onDone={onDone} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

	// Hydrate initial state.
	mockPostMessage({})

	// Helper function to activate a tab by clicking it
	const activateTab = async (tabId: string) => {
		const tabButton = screen.getByTestId(`tab-${tabId}`)
		fireEvent.click(tabButton)
		// Wait for the tab content to be visible
		await waitFor(() => {
			// The tab should be marked as selected
			expect(tabButton).toHaveAttribute("data-selected", "true")
		})
	}

	return { onDone, activateTab }
}

describe("SettingsView - allowedCommands external updates", () => {
	const mockVscodePostMessage = vi.mocked(vscode.postMessage)

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should update cached allowedCommands when extension state changes externally", async () => {
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		await activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Wait for allowed commands section to appear
		await waitFor(() => {
			expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
		})

		// Initially, there should be no allowed commands
		expect(screen.queryByText("npm test")).not.toBeInTheDocument()

		// Simulate external state update (like from "Add & Run")
		mockPostMessage({
			allowedCommands: ["npm test", "git status"],
			alwaysAllowExecute: true,
		})

		// Wait for the UI to update
		await waitFor(() => {
			// Check that the new commands appear in the UI
			expect(screen.getByText("npm test")).toBeInTheDocument()
			expect(screen.getByText("git status")).toBeInTheDocument()
		})

		// Verify that no save message was sent (since this was an external update)
		expect(mockVscodePostMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "allowedCommands",
			}),
		)
	})

	it("should handle multiple external updates to allowedCommands", async () => {
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		await activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		await waitFor(() => {
			expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
		})

		// First update
		mockPostMessage({
			allowedCommands: ["npm test"],
			alwaysAllowExecute: true,
		})

		await waitFor(() => {
			expect(screen.getByText("npm test")).toBeInTheDocument()
		})

		// Second update (adding more commands)
		mockPostMessage({
			allowedCommands: ["npm test", "npm run build", "echo hello"],
			alwaysAllowExecute: true,
		})

		await waitFor(() => {
			expect(screen.getByText("npm test")).toBeInTheDocument()
			expect(screen.getByText("npm run build")).toBeInTheDocument()
			expect(screen.getByText("echo hello")).toBeInTheDocument()
		})
	})

	it("should not mark settings as changed when allowedCommands update externally", async () => {
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		await activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		await waitFor(() => {
			expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
		})

		// Get initial state of save button
		const saveButton = screen.getByTestId("save-button")
		const initialClasses = saveButton.className

		// External update
		mockPostMessage({
			allowedCommands: ["npm test"],
			alwaysAllowExecute: true,
		})

		await waitFor(() => {
			expect(screen.getByText("npm test")).toBeInTheDocument()
		})

		// Save button should maintain its initial state (not change due to external update)
		expect(saveButton.className).toBe(initialClasses)

		// Verify that no save message was sent (since this was an external update)
		expect(mockVscodePostMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "allowedCommands",
			}),
		)
	})

	it("should replace user changes when external updates occur", async () => {
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		await activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Wait for allowed commands section to appear
		await waitFor(() => {
			expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
		})

		// Add a command manually
		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "npm start" } })
		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		// Wait for VSCode message to be sent
		await waitFor(() => {
			expect(mockVscodePostMessage).toHaveBeenCalledWith({
				type: "allowedCommands",
				commands: ["npm start"],
			})
		})

		// Simulate the state update that would come from VSCode after adding the command
		mockPostMessage({
			allowedCommands: ["npm start"],
			alwaysAllowExecute: true,
		})

		// The command should appear in the UI
		await waitFor(() => {
			expect(screen.getByText("npm start")).toBeInTheDocument()
		})

		// Clear the mock to ensure we don't count the manual addition
		mockVscodePostMessage.mockClear()

		// External update with different commands
		mockPostMessage({
			allowedCommands: ["npm test", "git status"],
			alwaysAllowExecute: true,
		})

		// Wait for external commands to appear
		await waitFor(() => {
			expect(screen.getByText("npm test")).toBeInTheDocument()
			expect(screen.getByText("git status")).toBeInTheDocument()
		})

		// The manually added command should be replaced by the external update
		expect(screen.queryByText("npm start")).not.toBeInTheDocument()

		// Verify that no save message was sent (since this was an external update)
		expect(mockVscodePostMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "allowedCommands",
			}),
		)
	})
})
