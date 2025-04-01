export const LOCK_TEXT_SYMBOL = "\u{1F512}"

// Mock jest functions
const mockDispose = jest.fn()
const mockOnDidChange = jest.fn().mockReturnValue({ dispose: mockDispose })
const mockOnDidCreate = jest.fn().mockReturnValue({ dispose: mockDispose })
const mockOnDidDelete = jest.fn().mockReturnValue({ dispose: mockDispose })

// Mock the actual implementation to avoid the error
jest.mock("../RooIgnoreController", () => {
	return {
		RooIgnoreController: jest.fn().mockImplementation(() => {
			return {
				initialize: jest.fn().mockResolvedValue(undefined),
				validateAccess: jest.fn().mockReturnValue(true),
				validateCommand: jest.fn().mockReturnValue(undefined),
				filterPaths: jest.fn().mockImplementation((paths) => paths),
				dispose: jest.fn(),
				getInstructions: jest.fn().mockReturnValue(undefined),
				rooIgnoreContent: undefined,
			}
		}),
	}
})

export class RooIgnoreController {
	rooIgnoreContent: string | undefined = undefined

	constructor(_cwd: string) {
		// No-op constructor
	}

	async initialize(): Promise<void> {
		// No-op initialization
		return Promise.resolve()
	}

	validateAccess(filePath: string): boolean {
		// Default implementation: allow all access
		return true
	}

	validateCommand(command: string): string | undefined {
		// Default implementation: allow all commands
		return undefined
	}

	filterPaths(paths: string[]): string[] {
		// Default implementation: allow all paths
		return paths
	}

	dispose(): void {
		// No-op dispose
	}

	getInstructions(): string | undefined {
		// Default implementation: no instructions
		return undefined
	}
}
