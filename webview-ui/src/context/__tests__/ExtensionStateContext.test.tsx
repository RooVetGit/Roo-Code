// npx jest webview-ui/src/context/__tests__/ExtensionStateContext.test.tsx

import { render, screen, act } from "@testing-library/react"

import { ExtensionState } from "../../../../src/shared/ExtensionMessage"
import { ExtensionStateContextProvider, useExtensionState, mergeExtensionState } from "../ExtensionStateContext"
import { ExperimentId } from "../../../../src/shared/experiments"
import { ApiConfiguration } from "../../../../src/shared/api"

// Test component that consumes the context
const TestComponent = () => {
	const { allowedCommands, setAllowedCommands, soundEnabled, showSeawolfIgnoredFiles, setShowSeawolfIgnoredFiles } =
		useExtensionState()
	return (
		<div>
			<div data-testid="allowed-commands">{JSON.stringify(allowedCommands)}</div>
			<div data-testid="sound-enabled">{JSON.stringify(soundEnabled)}</div>
			<div data-testid="show-seawolfignored-files">{JSON.stringify(showSeawolfIgnoredFiles)}</div>
			<button data-testid="update-button" onClick={() => setAllowedCommands(["npm install", "git status"])}>
				Update Commands
			</button>
			<button
				data-testid="toggle-seawolfignore-button"
				onClick={() => setShowSeawolfIgnoredFiles(!showSeawolfIgnoredFiles)}>
				Update Commands
			</button>
		</div>
	)
}

describe("ExtensionStateContext", () => {
	it("initializes with empty allowedCommands array", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("allowed-commands").textContent!)).toEqual([])
	})

	it("initializes with soundEnabled set to false", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("sound-enabled").textContent!)).toBe(false)
	})

	it("initializes with showSeawolfIgnoredFiles set to true", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("show-seawolfignored-files").textContent!)).toBe(true)
	})

	it("updates showSeawolfIgnoredFiles through setShowSeawolfIgnoredFiles", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			screen.getByTestId("toggle-seawolfignore-button").click()
		})

		expect(JSON.parse(screen.getByTestId("show-seawolfignored-files").textContent!)).toBe(false)
	})

	it("updates allowedCommands through setAllowedCommands", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			screen.getByTestId("update-button").click()
		})

		expect(JSON.parse(screen.getByTestId("allowed-commands").textContent!)).toEqual(["npm install", "git status"])
	})

	it("throws error when used outside provider", () => {
		// Suppress console.error for this test since we expect an error
		const consoleSpy = jest.spyOn(console, "error")
		consoleSpy.mockImplementation(() => {})

		expect(() => {
			render(<TestComponent />)
		}).toThrow("useExtensionState must be used within an ExtensionStateContextProvider")

		consoleSpy.mockRestore()
	})
})

describe("mergeExtensionState", () => {
	it("should correctly merge extension states", () => {
		const baseState: ExtensionState = {
			version: "",
			mcpEnabled: false,
			enableMcpServerCreation: false,
			clineMessages: [],
			taskHistory: [],
			shouldShowAnnouncement: false,
			enableCheckpoints: true,
			checkpointStorage: "task",
			writeDelayMs: 1000,
			requestDelaySeconds: 5,
			rateLimitSeconds: 0,
			mode: "default",
			experiments: {} as Record<ExperimentId, boolean>,
			customModes: [],
			maxOpenTabsContext: 20,
			maxWorkspaceFiles: 100,
			apiConfiguration: { providerId: "openrouter" } as ApiConfiguration,
			telemetrySetting: "unset",
			showSeawolfIgnoredFiles: true,
		}

		const prevState: ExtensionState = {
			...baseState,
			apiConfiguration: { modelMaxTokens: 1234, modelMaxThinkingTokens: 123 },
		}

		const newState: ExtensionState = {
			...baseState,
			apiConfiguration: { modelMaxThinkingTokens: 456, modelTemperature: 0.3 },
		}

		const result = mergeExtensionState(prevState, newState)

		expect(result.apiConfiguration).toEqual({
			modelMaxTokens: 1234,
			modelMaxThinkingTokens: 456,
			modelTemperature: 0.3,
		})
	})
})
