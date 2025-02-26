// Mock file system data
const mockFiles = new Map()
const mockDirectories = new Set()

// Initialize base test directories
const baseTestDirs = [
	"/mock",
	"/mock/extension",
	"/mock/extension/path",
	"/mock/storage",
	"/mock/storage/path",
	"/mock/settings",
	"/mock/settings/path",
	"/mock/mcp",
	"/mock/mcp/path",
	"/test",
	"/test/path",
	"/test/storage",
	"/test/storage/path",
	"/test/storage/path/settings",
	"/test/extension",
	"/test/extension/path",
	"/test/global-storage",
	"/test/log/path",
]

// Helper function to format instructions
const formatInstructions = (sections: string[]): string => {
	const joinedSections = sections.filter(Boolean).join("\n\n")
	return joinedSections
		? `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joinedSections}`
		: ""
}

// Helper function to format rule content
const formatRuleContent = (ruleFile: string, content: string): string => {
	return `Rules:\n# Rules from ${ruleFile}:\n${content}`
}

type RuleFiles = {
	".clinerules-code": string
	".clinerules-ask": string
	".clinerules-architect": string
	".clinerules-test": string
	".clinerules-review": string
	".clinerules": string
}

// Helper function to ensure directory exists
const ensureDirectoryExists = (path: string) => {
	const parts = path.split("/")
	let currentPath = ""
	for (const part of parts) {
		if (!part) continue
		currentPath += "/" + part
		mockDirectories.add(currentPath)
	}
}

const mockFs = {
	readFile: jest.fn().mockImplementation(async (filePath: string, encoding?: string) => {
		// Return stored content if it exists
		if (mockFiles.has(filePath)) {
			return mockFiles.get(filePath)
		}

		// Handle rule files
		const ruleFiles: RuleFiles = {
			".clinerules-code": "# Code Mode Rules\n1. Code specific rule",
			".clinerules-ask": "# Ask Mode Rules\n1. Ask specific rule",
			".clinerules-architect": "# Architect Mode Rules\n1. Architect specific rule",
			".clinerules-test":
				"# Test Engineer Rules\n1. Always write tests first\n2. Get approval before modifying non-test code",
			".clinerules-review":
				"# Code Reviewer Rules\n1. Provide specific examples in feedback\n2. Focus on maintainability and best practices",
			".clinerules": "# Test Rules\n1. First rule\n2. Second rule",
		}

		// Check for exact file name match
		const fileName = filePath.split("/").pop()
		if (fileName && fileName in ruleFiles) {
			return ruleFiles[fileName as keyof RuleFiles]
		}

		// Check for file name in path
		for (const [ruleFile, content] of Object.entries(ruleFiles)) {
			if (filePath.includes(ruleFile)) {
				return content
			}
		}

		// Handle file not found
		const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),

	writeFile: jest.fn().mockImplementation(async (path: string, content: string) => {
		// Ensure parent directory exists
		const parentDir = path.split("/").slice(0, -1).join("/")
		ensureDirectoryExists(parentDir)
		mockFiles.set(path, content)
		return Promise.resolve()
	}),

	mkdir: jest.fn().mockImplementation(async (path: string, options?: { recursive?: boolean }) => {
		// Always handle recursive creation
		const parts = path.split("/")
		let currentPath = ""

		// For recursive or test/mock paths, create all parent directories
		if (options?.recursive || path.startsWith("/test") || path.startsWith("/mock")) {
			for (const part of parts) {
				if (!part) continue
				currentPath += "/" + part
				mockDirectories.add(currentPath)
			}
			return Promise.resolve()
		}

		// For non-recursive paths, verify parent exists
		for (let i = 0; i < parts.length - 1; i++) {
			if (!parts[i]) continue
			currentPath += "/" + parts[i]
			if (!mockDirectories.has(currentPath)) {
				const error = new Error(`ENOENT: no such file or directory, mkdir '${path}'`)
				;(error as any).code = "ENOENT"
				throw error
			}
		}

		// Add the final directory
		currentPath += "/" + parts[parts.length - 1]
		mockDirectories.add(currentPath)
		return Promise.resolve()
		return Promise.resolve()
	}),

	unlink: jest.fn().mockImplementation(async (path: string) => {
		if (mockFiles.has(path)) {
			mockFiles.delete(path)
			return Promise.resolve()
		}
		// For test paths, always succeed even if the file doesn't exist
		if (path.startsWith("/test/")) {
			return Promise.resolve()
		}
		const error = new Error(`ENOENT: no such file or directory, unlink '${path}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),

	rm: jest.fn().mockImplementation(async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
		// If path is a directory and recursive is true, remove all files and directories under it
		if (mockDirectories.has(path) && options?.recursive) {
			// Remove all files that start with this path
			for (const filePath of mockFiles.keys()) {
				if (filePath.startsWith(path + "/")) {
					mockFiles.delete(filePath)
				}
			}
			// Remove all directories that start with this path
			for (const dirPath of Array.from(mockDirectories)) {
				if (typeof dirPath === "string" && dirPath.startsWith(path + "/")) {
					mockDirectories.delete(dirPath)
				}
			}
			// Remove the directory itself
			mockDirectories.delete(path)
			return Promise.resolve()
		}

		// If path is a file, remove it
		if (mockFiles.has(path)) {
			mockFiles.delete(path)
			return Promise.resolve()
		}

		// If force is true, don't throw an error if the path doesn't exist
		if (options?.force) {
			return Promise.resolve()
		}

		const error = new Error(`ENOENT: no such file or directory, rm '${path}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),

	rmdir: jest.fn().mockImplementation(async (path: string) => {
		if (mockDirectories.has(path)) {
			// Check if directory is empty
			for (const filePath of mockFiles.keys()) {
				if (filePath.startsWith(path + "/")) {
					const error = new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`)
					;(error as any).code = "ENOTEMPTY"
					throw error
				}
			}
			for (const dirPath of Array.from(mockDirectories)) {
				if (typeof dirPath === "string" && dirPath.startsWith(path + "/")) {
					const error = new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`)
					;(error as any).code = "ENOTEMPTY"
					throw error
				}
			}
			mockDirectories.delete(path)
			return Promise.resolve()
		}
		// For test paths, always succeed even if the directory doesn't exist
		if (path.startsWith("/test/")) {
			return Promise.resolve()
		}
		const error = new Error(`ENOENT: no such file or directory, rmdir '${path}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),

	access: jest.fn().mockImplementation(async (path: string) => {
		// Check if the path exists in either files or directories
		if (mockFiles.has(path) || mockDirectories.has(path) || path.startsWith("/test")) {
			return Promise.resolve()
		}
		const error = new Error(`ENOENT: no such file or directory, access '${path}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),

	constants: jest.requireActual("fs").constants,

	// Expose mock data for test assertions
	_mockFiles: mockFiles,
	_mockDirectories: mockDirectories,

	// Helper to set up initial mock data
	_setInitialMockData: () => {
		// Set up default MCP settings
		mockFiles.set(
			"/mock/settings/path/cline_mcp_settings.json",
			JSON.stringify({
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						disabled: false,
						alwaysAllow: ["existing-tool"],
					},
				},
			}),
		)

		// Ensure all base directories exist
		baseTestDirs.forEach((dir) => {
			const parts = dir.split("/")
			let currentPath = ""
			for (const part of parts) {
				if (!part) continue
				currentPath += "/" + part
				mockDirectories.add(currentPath)
			}
		})
	},
}

// Initialize mock data
mockFs._setInitialMockData()

module.exports = mockFs
