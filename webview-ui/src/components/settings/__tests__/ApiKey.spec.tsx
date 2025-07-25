import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { ApiKey } from "../ApiKey"

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, disabled, placeholder }: any) => (
		<div>
			<label>{children}</label>
			<input
				type="password"
				value={value || ""}
				onChange={(e) => onInput && onInput({ target: { value: e.target.value } })}
				disabled={disabled}
				placeholder={placeholder}
				data-testid="api-key-input"
			/>
		</div>
	),
}))

// Mock vscrui components
vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange, disabled }: any) => (
		<label data-testid="env-var-checkbox">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange && onChange(e.target.checked)}
				disabled={disabled}
				data-testid="env-var-checkbox-input"
			/>
			{children}
		</label>
	),
}))

// Mock VSCode button link
vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children, href }: any) => (
		<a href={href} data-testid="get-api-key-link">
			{children}
		</a>
	),
}))

// Mock i18next
vi.mock("i18next", () => ({
	t: (key: string, options?: any) => {
		const translations: Record<string, string> = {
			"settings:placeholders.apiKey": "Enter API key",
			"settings:providers.apiKeyStorageNotice": "API keys are stored locally",
			"settings:providers.apiKeyUseEnvVar": `Use environment variable ${options?.name || "ENV_VAR"}`,
		}
		return translations[key] || key
	},
}))

// Mock window.PROCESS_ENV
const mockProcessEnv = {
	ANTHROPIC_API_KEY: "existing-env-value",
	GEMINI_API_KEY: undefined,
}

// Mock global window object if not available
if (typeof window === 'undefined') {
	global.window = {} as any
}

Object.defineProperty(window, "PROCESS_ENV", {
	value: mockProcessEnv,
	writable: true,
})

describe("ApiKey Component", () => {
	const defaultProps = {
		apiKey: "",
		apiKeyEnvVar: "TEST_API_KEY",
		setApiKey: vi.fn(),
		setApiKeyUseEnvVar: vi.fn(),
		apiKeyLabel: "Test API Key",
		apiKeyUseEnvVar: false,
		getApiKeyUrl: "https://example.com/get-key",
		getApiKeyLabel: "Get API Key",
		disabled: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders with basic props", () => {
		render(<ApiKey {...defaultProps} />)
		
		expect(screen.getByText("Test API Key")).toBeInTheDocument()
		expect(screen.getByPlaceholderText("Enter API key")).toBeInTheDocument()
		expect(screen.getByText("API keys are stored locally")).toBeInTheDocument()
	})

	it("shows environment variable checkbox", () => {
		render(<ApiKey {...defaultProps} />)
		
		expect(screen.getByText("Use environment variable TEST_API_KEY")).toBeInTheDocument()
		expect(screen.getByTestId("env-var-checkbox")).toBeInTheDocument()
	})

	it("calls setApiKey when input value changes", () => {
		render(<ApiKey {...defaultProps} />)
		
		const input = screen.getByTestId("api-key-input")
		fireEvent.change(input, { target: { value: "new-api-key" } })
		
		expect(defaultProps.setApiKey).toHaveBeenCalledWith("new-api-key")
	})

	it("calls setApiKeyUseEnvVar when checkbox is toggled", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "ANTHROPIC_API_KEY", // This exists in mockProcessEnv
		}
		
		render(<ApiKey {...props} />)
		
		const checkbox = screen.getByTestId("env-var-checkbox-input")
		fireEvent.click(checkbox)
		
		expect(props.setApiKeyUseEnvVar).toHaveBeenCalledWith(true)
	})

	it("disables input when useEnvVar is true and env var exists", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "ANTHROPIC_API_KEY", // This exists in mockProcessEnv
			apiKeyUseEnvVar: true,
		}
		
		render(<ApiKey {...props} />)
		
		const input = screen.getByTestId("api-key-input")
		expect(input).toBeDisabled()
	})

	it("disables input when disabled prop is true", () => {
		const props = {
			...defaultProps,
			disabled: true,
		}
		
		render(<ApiKey {...props} />)
		
		const input = screen.getByTestId("api-key-input")
		expect(input).toBeDisabled()
	})

	it("shows get API key button when no key is provided and URLs are given", () => {
		render(<ApiKey {...defaultProps} />)
		
		expect(screen.getByText("Get API Key")).toBeInTheDocument()
		expect(screen.getByTestId("get-api-key-link")).toHaveAttribute("href", "https://example.com/get-key")
	})

	it("does not show get API key button when API key is provided", () => {
		const props = {
			...defaultProps,
			apiKey: "existing-key",
		}
		
		render(<ApiKey {...props} />)
		
		expect(screen.queryByText("Get API Key")).not.toBeInTheDocument()
	})

	it("does not show get API key button when using env var with existing env value", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "ANTHROPIC_API_KEY", // This exists in mockProcessEnv
			apiKeyUseEnvVar: true,
		}
		
		render(<ApiKey {...props} />)
		
		expect(screen.queryByText("Get API Key")).not.toBeInTheDocument()
	})

	it("disables checkbox when environment variable does not exist", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "NONEXISTENT_API_KEY",
		}
		
		render(<ApiKey {...props} />)
		
		const checkbox = screen.getByTestId("env-var-checkbox-input")
		expect(checkbox).toBeDisabled()
	})

	it("enables checkbox when environment variable exists", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "ANTHROPIC_API_KEY", // This exists in mockProcessEnv
		}
		
		render(<ApiKey {...props} />)
		
		const checkbox = screen.getByTestId("env-var-checkbox-input")
		expect(checkbox).not.toBeDisabled()
	})

	it("handles checkbox state correctly when env var exists and is initially checked", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "ANTHROPIC_API_KEY", // This exists in mockProcessEnv
			apiKeyUseEnvVar: true,
		}
		
		render(<ApiKey {...props} />)
		
		const checkbox = screen.getByTestId("env-var-checkbox-input")
		expect(checkbox).toBeChecked()
		expect(screen.getByTestId("api-key-input")).toBeDisabled()
	})

	it("unchecks checkbox when env var does not exist but is initially checked", () => {
		const props = {
			...defaultProps,
			apiKeyEnvVar: "NONEXISTENT_API_KEY",
			apiKeyUseEnvVar: true,
		}
		
		render(<ApiKey {...props} />)
		
		// The component should internally set useEnvVar to false when env var doesn't exist
		const checkbox = screen.getByTestId("env-var-checkbox-input")
		expect(checkbox).not.toBeChecked()
		expect(screen.getByTestId("api-key-input")).not.toBeDisabled()
	})
})