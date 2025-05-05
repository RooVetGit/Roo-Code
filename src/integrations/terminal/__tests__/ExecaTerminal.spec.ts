// npx vitest run src/integrations/terminal/__tests__/ExecaTerminal.spec.ts

import { vi, describe, it, expect } from "vitest"

import { RooTerminalCallbacks } from "../types"
import { ExecaTerminal } from "../ExecaTerminal"

describe("ExecaTerminal", () => {
	it("should be a test", async () => {
		const terminal = new ExecaTerminal(1, "/tmp")

		let result

		const callbacks: RooTerminalCallbacks = {
			onLine: vi.fn(),
			onCompleted: (output) => (result = output),
			onShellExecutionStarted: vi.fn(),
			onShellExecutionComplete: vi.fn(),
		}

		const subprocess =
			process.platform === "win32"
				? terminal.runCommand("dir", callbacks)
				: terminal.runCommand("ls -al", callbacks)

		await subprocess

		expect(callbacks.onLine).toHaveBeenCalled()
		expect(callbacks.onShellExecutionStarted).toHaveBeenCalled()
		expect(callbacks.onShellExecutionComplete).toHaveBeenCalled()

		expect(result).toBeTypeOf("string")

		if (process.platform !== "win32") {
			expect(result).toContain("total")
		}
	})
})
