// Mock for the 'execa' package

// Mock ExecaError class for instanceof checks
class ExecaError extends Error {
	constructor(message, options = {}) {
		super(message)
		this.name = "ExecaError"
		this.exitCode = options.exitCode ?? 1
		this.signal = options.signal ?? undefined
		this.stdout = options.stdout ?? ""
		this.stderr = options.stderr ?? ""
		this.all = options.all ?? ""
		this.failed = options.failed ?? true
		this.timedOut = options.timedOut ?? false
		this.isCanceled = options.isCanceled ?? false
		this.isKilled = options.isKilled ?? false
		// Add any other properties accessed in tests if needed
	}
}

// Mock the main execa function (handling tagged template literal usage)
const mockExeca = (_options) => {
	// Prefix unused parameter with _
	// The tagged template literal part is ignored in this simple mock
	// We just return an object simulating the subprocess
	const subprocess = (async function* () {
		// Yield some mock output lines
		yield "Mock execa output line 1"
		yield "Mock execa output line 2"
		// Simulate command completion (or potential error throwing if needed for tests)
	})()

	// Add properties/methods expected on the subprocess object if needed by tests
	// For now, just making it async iterable is the main requirement from ExecaTerminalProcess.ts
	subprocess.stdout = { pipe: () => {} } // Mock minimal stream properties if needed
	subprocess.stderr = { pipe: () => {} }
	subprocess.all = { pipe: () => {} } // If combined output stream is used

	// Mock the promise interface if needed (e.g., if .then() is called on the result)
	subprocess.then = (resolve, reject) => {
		// Simulate successful completion after iteration
		Promise.resolve().then(async () => {
			try {
				// eslint-disable-next-line no-empty,@typescript-eslint/no-unused-vars
				for await (const _ of subprocess) {
				} // Consume the generator
				resolve({ exitCode: 0, stdout: "Mock stdout", stderr: "Mock stderr" })
			} catch (error) {
				reject(error)
			}
		})
	}
	subprocess.catch = (reject) => {
		// Simulate successful completion by not calling reject
		// Modify this if tests require catching specific errors
		Promise.resolve().then(async () => {
			try {
				// eslint-disable-next-line no-empty,@typescript-eslint/no-unused-vars
				for await (const _ of subprocess) {
				} // Consume the generator
			} catch (error) {
				reject(error) // Pass through errors from the generator if any
			}
		})
	}
	subprocess.finally = (callback) => {
		Promise.resolve(subprocess).finally(callback)
	}

	return subprocess
}

module.exports = {
	execa: mockExeca,
	ExecaError: ExecaError,
}
