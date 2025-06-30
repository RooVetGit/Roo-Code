import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { execa } from "execa"
import readline from "readline"

// Skip tests on non-Windows platforms
const isWindows = process.platform === "win32"
const describePlatform = isWindows ? describe : describe.skip

// Mock dependencies
vi.mock("fs")
vi.mock("path")
vi.mock("os")
vi.mock("execa")
vi.mock("readline")

// Mock vscode workspace
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
}))

describePlatform("Windows WSL Integration", () => {
	// Store original values
	const originalPid = process.pid
	const originalDateNow = Date.now

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()

		// Setup common mocks
		vi.mocked(os.tmpdir).mockReturnValue("C:\\temp")
		vi.mocked(path.join).mockImplementation((...args) => args.join("\\"))
		vi.mocked(fs.existsSync).mockReturnValue(false)
		vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)

		// Mock process.pid using Object.defineProperty
		Object.defineProperty(process, "pid", { value: 12345 })

		// Mock Date.now using vi.spyOn
		vi.spyOn(Date, "now").mockImplementation(() => 1000000)

		// Mock readline.createInterface
		vi.mocked(readline.createInterface).mockReturnValue({
			[Symbol.asyncIterator]: () => ({
				next: async () => ({ done: true, value: undefined }),
			}),
			close: vi.fn(),
		} as any)

		// Mock execa to return a process-like object
		vi.mocked(execa).mockReturnValue({
			stdout: { pipe: vi.fn(), on: vi.fn() },
			stderr: { on: vi.fn() },
			on: vi.fn(),
			finally: vi.fn().mockImplementation((fn) => {
				fn() // Call the cleanup function immediately for testing
				return { on: vi.fn() }
			}),
			kill: vi.fn(),
			killed: false,
			exitCode: 0, // Add exitCode property to avoid "process exited with code undefined" error
			then: vi.fn().mockImplementation((callback) => {
				callback({ exitCode: 0 }) // Mock the Promise resolution
				return Promise.resolve({ exitCode: 0 })
			}),
		} as any)
	})

	afterEach(() => {
		// Restore original values
		Object.defineProperty(process, "pid", { value: originalPid })
		vi.restoreAllMocks() // This will restore Date.now and other spies
	})

	test("should use WSL on Windows platform and call execa correctly", async () => {
		// Mock process.platform to simulate Windows
		const originalPlatform = process.platform
		Object.defineProperty(process, "platform", { value: "win32" })

		try {
			// Import the module under test
			const { runClaudeCode } = await import("../run")

			// Setup test data
			const options = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
				modelId: "claude-3-opus-20240229",
			}

			// Start the generator
			const generator = runClaudeCode(options)

			try {
				// Consume the generator to trigger the code
				await generator.next()

				// Verify temporary directory was created
				expect(fs.existsSync).toHaveBeenCalledWith("C:\\temp\\.claude-code-temp")
				expect(fs.mkdirSync).toHaveBeenCalledWith("C:\\temp\\.claude-code-temp", { recursive: true })

				// Verify temporary files were created
				expect(fs.writeFileSync).toHaveBeenCalledTimes(2)
				expect(fs.writeFileSync).toHaveBeenCalledWith(
					"C:\\temp\\.claude-code-temp\\messages-1000000-12345.json",
					JSON.stringify(options.messages),
					"utf8",
				)
				expect(fs.writeFileSync).toHaveBeenCalledWith(
					"C:\\temp\\.claude-code-temp\\system-prompt-1000000-12345.txt",
					options.systemPrompt,
					"utf8",
				)

				// Verify execa was called with WSL and correct parameters
				expect(execa).toHaveBeenCalledTimes(1)
				expect(execa).toHaveBeenCalledWith(
					"wsl",
					expect.arrayContaining([
						"claude",
						"-p",
						expect.stringContaining("/mnt/c/temp/.claude-code-temp/messages-1000000-12345.json"),
						"--system-prompt",
						expect.stringContaining("/mnt/c/temp/.claude-code-temp/system-prompt-1000000-12345.txt"),
						"--verbose",
						"--output-format",
						"stream-json",
						"--disallowedTools",
						expect.any(String),
						"--max-turns",
						"1",
						"--model",
						"claude-3-opus-20240229",
					]),
					expect.objectContaining({
						env: expect.objectContaining({
							CLAUDE_CODE_MAX_OUTPUT_TOKENS: "64000",
						}),
					}),
				)

				// Verify cleanup was registered
				expect(vi.mocked(execa).mock.results[0].value.finally).toHaveBeenCalled()

				// Verify files were cleaned up (since we call the cleanup function in our mock)
				expect(fs.unlinkSync).toHaveBeenCalledTimes(2)
				expect(fs.unlinkSync).toHaveBeenCalledWith("C:\\temp\\.claude-code-temp\\messages-1000000-12345.json")
				expect(fs.unlinkSync).toHaveBeenCalledWith(
					"C:\\temp\\.claude-code-temp\\system-prompt-1000000-12345.txt",
				)

				// Verify directory cleanup was attempted
				expect(fs.readdirSync).toHaveBeenCalledWith("C:\\temp\\.claude-code-temp")
			} finally {
				// Clean up the generator
				await generator.return(undefined)
			}
		} finally {
			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })
		}
	})

	test("should convert Windows paths to WSL paths correctly", async () => {
		// Mock process.platform to simulate Windows
		const originalPlatform = process.platform
		Object.defineProperty(process, "platform", { value: "win32" })

		try {
			// Import the module under test
			const { runClaudeCode } = await import("../run")

			// Setup test data
			const options = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
			}

			// Start the generator
			const generator = runClaudeCode(options)

			try {
				// Consume the generator to trigger the code
				await generator.next()

				// Verify execa was called with correctly converted WSL paths
				expect(execa).toHaveBeenCalledWith(
					"wsl",
					expect.arrayContaining([
						expect.stringContaining("/mnt/c/temp/.claude-code-temp/messages-1000000-12345.json"),
						expect.stringContaining("/mnt/c/temp/.claude-code-temp/system-prompt-1000000-12345.txt"),
					]),
					expect.anything(),
				)
			} finally {
				// Clean up the generator
				await generator.return(undefined)
			}
		} finally {
			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })
		}
	})

	test("should handle error cases gracefully", async () => {
		// Mock process.platform to simulate Windows
		const originalPlatform = process.platform
		Object.defineProperty(process, "platform", { value: "win32" })

		try {
			// Mock execa to throw an error
			vi.mocked(execa).mockImplementationOnce(() => {
				throw new Error("WSL not installed")
			})

			// Import the module under test
			const { runClaudeCode } = await import("../run")

			// Setup test data
			const options = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
			}

			// Start the generator - should throw an error
			const generator = runClaudeCode(options)

			// Verify that the error is properly handled
			await expect(generator.next()).rejects.toThrow("Failed to execute Claude CLI via WSL")

			// Verify cleanup was still called
			expect(fs.unlinkSync).toHaveBeenCalledTimes(2)
		} finally {
			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })
		}
	})

	test("should handle process errors correctly", async () => {
		// Mock process.platform to simulate Windows
		const originalPlatform = process.platform
		Object.defineProperty(process, "platform", { value: "win32" })

		try {
			// Mock readline.createInterface
			vi.mocked(readline.createInterface).mockReturnValue({
				[Symbol.asyncIterator]: () => ({
					next: async () => ({ done: true, value: undefined }),
				}),
				close: vi.fn(),
			} as any)

			// Setup a mock that will emit an error
			const mockProcess = {
				stdout: { pipe: vi.fn(), on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn().mockImplementation((event, callback) => {
					if (event === "error") {
						// Simulate an error event immediately
						callback(new Error("Process error"))
					}
					return mockProcess
				}),
				finally: vi.fn().mockReturnValue({ on: vi.fn() }),
				kill: vi.fn(),
				killed: false,
			}

			vi.mocked(execa).mockReturnValueOnce(mockProcess as any)

			// Import the module under test
			const { runClaudeCode } = await import("../run")

			// Setup test data
			const options = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
			}

			// Start the generator
			const generator = runClaudeCode(options)

			// Verify that the error is properly propagated
			await expect(generator.next()).rejects.toThrow("Process error")
		} finally {
			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })
		}
	})
})
