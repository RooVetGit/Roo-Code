import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CodeIndexSettings } from "../CodeIndexSettings"
import { vscode } from "../../../utils/vscode"

// Mock vscode utilities
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock translation hook - just return the key to verify correct keys are used
vi.mock("../../../i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock doc links
vi.mock("../../../utils/docLinks", () => ({
	buildDocLink: () => "https://docs.example.com",
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ children }: any) => <div>{children}</div>,
}))

// Mock VSCode webview UI toolkit
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ checked, onChange, children }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={onChange} data-testid="vscode-checkbox" />
			{children}
		</label>
	),
	VSCodeLink: ({ href, children, style }: any) => (
		<a href={href} style={style} data-testid="vscode-link">
			{children}
		</a>
	),
}))

describe("CodeIndexSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders with default settings when no config provided", () => {
		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={undefined} />)

		// Should show unchecked checkbox
		const checkbox = screen.getByTestId("vscode-checkbox")
		expect(checkbox).not.toBeChecked()

		// Should show enable label
		expect(screen.getByText("settings:codeIndex.enableLabel")).toBeInTheDocument()
	})

	it("renders with provided config settings", () => {
		const mockConfig = {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai" as const,
			codebaseIndexEmbedderModelId: "text-embedding-ada-002",
		}

		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={mockConfig} />)

		// Should show checked checkbox
		const checkbox = screen.getByTestId("vscode-checkbox")
		expect(checkbox).toBeChecked()
	})

	it("handles checkbox toggle", () => {
		const mockConfig = {
			codebaseIndexEnabled: false,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai" as const,
			codebaseIndexEmbedderModelId: "text-embedding-ada-002",
		}

		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={mockConfig} />)

		const checkbox = screen.getByTestId("vscode-checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "codebaseIndexEnabled",
			isEnabled: true,
		})
	})

	it("handles checkbox toggle when config is undefined", () => {
		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={undefined} />)

		const checkbox = screen.getByTestId("vscode-checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "codebaseIndexEnabled",
			isEnabled: true,
		})
	})

	it("renders documentation link", () => {
		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={undefined} />)

		const link = screen.getByTestId("vscode-link")
		expect(link).toHaveAttribute("href", "https://docs.example.com")
	})
})
