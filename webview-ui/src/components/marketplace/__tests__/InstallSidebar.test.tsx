import { fireEvent, screen } from "@testing-library/react"
import InstallSidebar from "../InstallSidebar"
import { MarketplaceItem } from "../../../../../src/services/marketplace/types"
import type { RocketConfig } from "config-rocket"
import { renderWithProviders } from "@/test/test-utils"

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, appearance }: any) => (
		<button onClick={onClick} data-appearance={appearance}>
			{children}
		</button>
	),
	VSCodeTextField: ({ id, value, onChange }: any) => (
		<input
			type="text"
			id={id}
			value={value}
			onChange={(e) => onChange({ target: e.target })}
			data-testid={`text-${id}`}
		/>
	),
	VSCodeCheckbox: ({ id, checked, onChange }: any) => (
		<input
			type="checkbox"
			id={id}
			checked={checked}
			onChange={(e) => onChange({ target: e.target })}
			data-testid={`checkbox-${id}`}
		/>
	),
}))

describe("InstallSidebar", () => {
	const mockItem: MarketplaceItem = {
		id: "test-item",
		name: "Test Item",
		description: "Test Description",
		type: "package",
		url: "https://test.com",
		repoUrl: "https://github.com/test/repo",
		author: "Test Author",
		version: "1.0.0",
	}

	const mockConfig: RocketConfig = {
		parameters: [
			{
				id: "testText",
				resolver: {
					operation: "prompt",
					type: "text",
					label: "Text Input",
					initial: "default text",
				},
			},
			{
				id: "testConfirm",
				resolver: {
					operation: "prompt",
					type: "confirm",
					label: "Confirm Input",
					initial: true,
				},
			},
		],
	}

	it("renders sidebar with item name", () => {
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={() => {}} onSubmit={() => {}} />,
		)

		expect(screen.getByText(`Install ${mockItem.name}`)).toBeInTheDocument()
	})

	it("renders text input parameter", () => {
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={() => {}} onSubmit={() => {}} />,
		)

		const textInput = screen.getByTestId("text-testText")
		expect(textInput).toBeInTheDocument()
		expect(textInput).toHaveValue("default text")
	})

	it("renders checkbox parameter", () => {
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={() => {}} onSubmit={() => {}} />,
		)

		const checkbox = screen.getByTestId("checkbox-testConfirm")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).toBeChecked()
	})

	it("updates text parameter value", () => {
		const onSubmit = jest.fn()
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={() => {}} onSubmit={onSubmit} />,
		)

		const textInput = screen.getByTestId("text-testText")
		fireEvent.change(textInput, { target: { value: "new value" } })

		const installButton = screen.getByText("Install")
		fireEvent.click(installButton)

		expect(onSubmit).toHaveBeenCalledWith(mockItem, {
			testText: "new value",
			testConfirm: true,
		})
	})

	it("updates checkbox parameter value", () => {
		const onSubmit = jest.fn()
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={() => {}} onSubmit={onSubmit} />,
		)

		const checkbox = screen.getByTestId("checkbox-testConfirm")
		fireEvent.click(checkbox)

		const installButton = screen.getByText("Install")
		fireEvent.click(installButton)

		expect(onSubmit).toHaveBeenCalledWith(mockItem, {
			testText: "default text",
			testConfirm: false,
		})
	})

	it("calls onClose when clicking outside sidebar", () => {
		const onClose = jest.fn()
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={onClose} onSubmit={() => {}} />,
		)

		// Click the overlay (parent div)
		const overlay = screen.getByText(`Install ${mockItem.name}`).parentElement?.parentElement
		if (overlay) {
			fireEvent.click(overlay)
		}

		expect(onClose).toHaveBeenCalled()
	})

	it("calls onClose when clicking cancel button", () => {
		const onClose = jest.fn()
		renderWithProviders(
			<InstallSidebar item={mockItem} config={mockConfig} onClose={onClose} onSubmit={() => {}} />,
		)

		const cancelButton = screen.getByText("Cancel")
		fireEvent.click(cancelButton)

		expect(onClose).toHaveBeenCalled()
	})
})
