import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import OrganizationDefaultProviders from "../OrganizationDefaultProviders"
import { PROVIDERS } from "../constants"

// Mock the translation context
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock the ApiOptions component
vi.mock("../ApiOptions", () => ({
	default: ({ apiConfiguration, setApiConfigurationField }: any) => (
		<div data-testid="api-options-mock">
			<div>Provider: {apiConfiguration.apiProvider}</div>
			<button
				onClick={() => setApiConfigurationField("apiProvider", "anthropic")}
				data-testid="set-provider">
				Set Provider
			</button>
		</div>
	),
}))

// Mock UI components
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
	Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
	DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
	DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
	DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
	DialogTrigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
	Input: ({ value, onChange, ...props }: any) => (
		<input
			value={value}
			onChange={(e) => onChange?.(e)}
			{...props}
		/>
	),
	Textarea: ({ value, onChange, ...props }: any) => (
		<textarea
			value={value}
			onChange={(e) => onChange?.(e)}
			{...props}
		/>
	),
	Checkbox: ({ checked, onChange, children }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange?.(e.target.checked)}
			/>
			{children}
		</label>
	),
}))

const mockDefaultProviders = {
	enabled: false,
	profiles: [],
}

const mockDefaultProvidersWithProfiles = {
	enabled: true,
	profiles: [
		{
			id: "profile-1",
			name: "Primary OpenAI",
			description: "Main OpenAI configuration",
			isRecommended: true,
			priority: 1,
			settings: {
				apiProvider: "openai",
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
			},
		},
		{
			id: "profile-2",
			name: "Fallback Anthropic",
			description: "Backup Anthropic configuration",
			isRecommended: false,
			priority: 2,
			settings: {
				apiProvider: "anthropic",
				apiKey: "test-anthropic-key",
				apiModelId: "claude-3-sonnet-20240229",
			},
		},
	],
	primaryProfileId: "profile-1",
	fallbackProfileIds: ["profile-2"],
}

const mockOrganizationAllowList = {
	allowAll: true,
	providers: {},
}

describe("OrganizationDefaultProviders", () => {
	const mockOnUpdate = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the component with disabled state", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProviders}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		expect(screen.getByText("settings:organizationDefaultProviders.title")).toBeInTheDocument()
		expect(screen.getByText("settings:organizationDefaultProviders.description")).toBeInTheDocument()
		expect(screen.getByText("settings:organizationDefaultProviders.enabled")).toBeInTheDocument()
	})

	it("shows profiles section when enabled", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProvidersWithProfiles}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		expect(screen.getByText("settings:organizationDefaultProviders.profiles")).toBeInTheDocument()
		expect(screen.getByText("settings:organizationDefaultProviders.addProfile")).toBeInTheDocument()
	})

	it("displays existing profiles", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProvidersWithProfiles}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		expect(screen.getByText("Primary OpenAI")).toBeInTheDocument()
		expect(screen.getByText("Fallback Anthropic")).toBeInTheDocument()
		expect(screen.getByText("Main OpenAI configuration")).toBeInTheDocument()
		expect(screen.getByText("Backup Anthropic configuration")).toBeInTheDocument()
	})

	it("shows primary profile indicator", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProvidersWithProfiles}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		expect(screen.getByText("settings:organizationDefaultProviders.primary")).toBeInTheDocument()
	})

	it("shows recommended profile indicator", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProvidersWithProfiles}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		// Should show star indicator for recommended profile
		expect(screen.getByText("★")).toBeInTheDocument()
	})

	it("toggles enabled state", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProviders}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		const checkbox = screen.getByRole("checkbox")
		fireEvent.click(checkbox)

		expect(mockOnUpdate).toHaveBeenCalledWith({
			...mockDefaultProviders,
			enabled: true,
		})
	})

	it("shows no profiles message when no profiles exist", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={{ enabled: true, profiles: [] }}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		expect(screen.getByText("settings:organizationDefaultProviders.noProfiles")).toBeInTheDocument()
	})

	it("displays provider names correctly", () => {
		render(
			<OrganizationDefaultProviders
				defaultProviders={mockDefaultProvidersWithProfiles}
				onUpdate={mockOnUpdate}
				organizationAllowList={mockOrganizationAllowList}
			/>,
		)

		// Should show provider labels from PROVIDERS constant
		const openAiProvider = PROVIDERS.find((p) => p.value === "openai")
		const anthropicProvider = PROVIDERS.find((p) => p.value === "anthropic")

		if (openAiProvider) {
			expect(screen.getByText(new RegExp(openAiProvider.label))).toBeInTheDocument()
		}
		if (anthropicProvider) {
			expect(screen.getByText(new RegExp(anthropicProvider.label))).toBeInTheDocument()
		}
	})
})