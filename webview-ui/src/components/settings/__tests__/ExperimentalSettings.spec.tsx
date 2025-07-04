// npx vitest src/components/settings/__tests__/ExperimentalSettings.spec.tsx

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { ExperimentalSettings } from "../ExperimentalSettings"
import type { Experiments, CodebaseIndexConfig, CodebaseIndexModels } from "@roo-code/types"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:codeIndex.searchMaxResultsLabel": "Maximum Search Results",
				"settings:codeIndex.searchMaxResultsDescription":
					"Maximum number of results to return from codebase search",
				"settings:codeIndex.resetToDefault": "Reset to Default",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId, min = 0, max = 100, step = 1 }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => {
				const newValue = parseFloat(e.target.value)
				// Clamp the value between min and max
				const clampedValue = Math.min(Math.max(newValue, min), max)
				onValueChange([clampedValue])
			}}
			data-testid={dataTestId}
			role="slider"
			min={min}
			max={max}
			step={step}
		/>
	),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, onChange, checked, ...props }: any) => (
		<label>
			<input
				type="checkbox"
				role="checkbox"
				checked={checked || false}
				aria-checked={checked || false}
				onChange={(e: any) => onChange?.({ target: { checked: e.target.checked } })}
				{...props}
			/>
			{children}
		</label>
	),
	VSCodeButton: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
	VSCodeLink: ({ children, href, ...props }: any) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}))

describe("ExperimentalSettings", () => {
	const mockExperiments: Experiments = {
		powerSteering: false,
		multiFileApplyDiff: false,
	}

	const mockCodebaseIndexModels: CodebaseIndexModels = {
		openai: {
			"text-embedding-3-small": { dimension: 1536 },
			"text-embedding-3-large": { dimension: 3072 },
		},
	}

	const mockCodebaseIndexConfig: CodebaseIndexConfig = {
		codebaseIndexEnabled: true,
		codebaseIndexQdrantUrl: "http://localhost:6333",
		codebaseIndexEmbedderProvider: "openai",
		codebaseIndexEmbedderModelId: "text-embedding-3-small",
		codebaseIndexSearchMinScore: 0.4,
		codebaseIndexSearchMaxResults: 50,
	}

	const mockSetExperimentEnabled = vi.fn()
	const mockSetCachedStateField = vi.fn()

	const defaultProps = {
		experiments: mockExperiments,
		setExperimentEnabled: mockSetExperimentEnabled,
		codebaseIndexModels: mockCodebaseIndexModels,
		codebaseIndexConfig: mockCodebaseIndexConfig,
		codebaseIndexEnabled: false,
		setCachedStateField: mockSetCachedStateField,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("codebaseIndexSearchMaxResults slider", () => {
		it("renders with default value when codebase index is enabled", () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			const slider = screen.getByTestId("search-max-results-slider")
			expect(slider).toBeInTheDocument()
			expect(slider).toHaveAttribute("value", "50")
		})

		it("does not render when codebase index is disabled", () => {
			render(<ExperimentalSettings {...defaultProps} />)

			const slider = screen.queryByTestId("search-max-results-slider")
			expect(slider).not.toBeInTheDocument()
		})

		it("updates value when slider is changed", async () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			const slider = screen.getByTestId("search-max-results-slider")
			fireEvent.change(slider, { target: { value: "100" } })

			await waitFor(() => {
				expect(mockSetCachedStateField).toHaveBeenCalledWith("codebaseIndexConfig", {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 100,
				})
			})
		})

		it("respects minimum value of 10", async () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			const slider = screen.getByTestId("search-max-results-slider")
			fireEvent.change(slider, { target: { value: "5" } })

			// The slider component should enforce the minimum of 10
			await waitFor(() => {
				expect(mockSetCachedStateField).toHaveBeenCalledWith("codebaseIndexConfig", {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 10,
				})
			})
		})

		it("respects maximum value of 200", async () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			const slider = screen.getByTestId("search-max-results-slider")
			fireEvent.change(slider, { target: { value: "200" } })

			// The slider component should enforce the maximum
			await waitFor(() => {
				expect(mockSetCachedStateField).toHaveBeenCalledWith("codebaseIndexConfig", {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 200,
				})
			})
		})

		it("shows reset button when value differs from default", () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
				codebaseIndexConfig: {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 100,
				},
			}

			render(<ExperimentalSettings {...props} />)

			const resetButton = screen.getByTitle("Reset to Default")
			expect(resetButton).toBeInTheDocument()
		})

		it("reset button is always visible when codebase index is enabled", () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			// The reset button is always rendered, not conditionally
			const resetButton = screen.queryByTitle("Reset to Default")
			expect(resetButton).toBeInTheDocument()
		})

		it("resets to default value when reset button is clicked", async () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
				codebaseIndexConfig: {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 100,
				},
			}

			render(<ExperimentalSettings {...props} />)

			const resetButton = screen.getByTitle("Reset to Default")
			fireEvent.click(resetButton)

			await waitFor(() => {
				expect(mockSetCachedStateField).toHaveBeenCalledWith("codebaseIndexConfig", {
					...mockCodebaseIndexConfig,
					codebaseIndexSearchMaxResults: 50,
				})
			})
		})

		it("displays correct label and description", () => {
			const props = {
				...defaultProps,
				codebaseIndexEnabled: true,
			}

			render(<ExperimentalSettings {...props} />)

			expect(screen.getByText("Maximum Search Results")).toBeInTheDocument()
			expect(screen.getByText("Maximum number of results to return from codebase search")).toBeInTheDocument()
		})
	})
})
