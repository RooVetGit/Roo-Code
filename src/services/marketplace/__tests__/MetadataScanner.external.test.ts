import * as path from "path"
import { GitFetcher } from "../GitFetcher"
import * as vscode from "vscode"

describe("MetadataScanner External References", () => {
	// TODO: remove this note
	// This test is expected to fail until we update the registry with the new wordings (`mcp server` => `mcp`)
	it.skip("should find all subcomponents in Project Manager package including external references", async () => {
		// Create a GitFetcher instance using the project's mock settings directory
		const mockContext = {
			globalStorageUri: { fsPath: path.resolve(__dirname, "../../../../mock/settings") },
		} as vscode.ExtensionContext
		const gitFetcher = new GitFetcher(mockContext)

		// Fetch the marketplace repository
		const repoUrl = "https://github.com/RooCodeInc/Roo-Code-Marketplace"
		const repo = await gitFetcher.fetchRepository(repoUrl)

		// Find the Project Manager package
		const projectManager = repo.items.find((item) => item.name === "Project Manager Package")
		expect(projectManager).toBeDefined()
		expect(projectManager?.type).toBe("package")

		// Verify it has exactly 2 subcomponents
		expect(projectManager?.items).toBeDefined()
		expect(projectManager?.items?.length).toBe(2)

		// Verify one is a mode and one is an MCP server
		const hasMode = projectManager?.items?.some((item) => item.type === "mode")
		const hasMcpServer = projectManager?.items?.some((item) => item.type === "mcp")
		expect(hasMode).toBe(true)
		expect(hasMcpServer).toBe(true)

		// Verify the MCP server is the Smartsheet component
		const smartsheet = projectManager?.items?.find(
			(item) => item.metadata?.name === "Smartsheet MCP - Project Management",
		)
		expect(smartsheet).toBeDefined()
		expect(smartsheet?.type).toBe("mcp")
	})
})
