// npx vitest run src/core/command-executors/__tests__/ExecaCommandExecutor.test.ts

import { describe, it, expect } from "vitest"

import { ExecaCommandExecutor } from "../ExecaCommandExecutor"

describe("ExecaCommandExecutor", () => {
	it("should execute a command", async () => {
		const commandExecutor = new ExecaCommandExecutor()
		let i = 0
		let controller: AbortController | undefined = undefined

		await commandExecutor.execute({
			command: "yes foo",
			cwd: ".",
			onStarted: (c) => (controller = c),
			onLine: () => {
				i += 1

				if (i > 100) {
					controller?.abort()
				}
			},
			onCompleted: () => {},
			onShellExecutionComplete: () => {},
		})

		expect(i).toBeGreaterThan(100)
	})
})
