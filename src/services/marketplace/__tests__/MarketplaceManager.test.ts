import { MarketplaceManager } from "../MarketplaceManager"
import { MarketplaceItem, MarketplaceSource, MarketplaceRepository, MarketplaceItemType } from "../types"
import { MetadataScanner } from "../MetadataScanner"
import { GitFetcher } from "../GitFetcher"
import * as path from "path"
import * as vscode from "vscode"

describe("MarketplaceManager", () => {
	describe("filterItems", () => {
		// Create a mock context with required properties
		const mockContext = {
			globalStorageUri: {
				fsPath: path.resolve(__dirname, "../../../../mock/settings/path"),
			},
			extensionPath: path.resolve(__dirname, "../../../../"),
			subscriptions: [],
			workspaceState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			asAbsolutePath: jest.fn((p) => p),
			storagePath: "",
			logPath: "",
			extensionUri: { fsPath: "" },
			environmentVariableCollection: {},
			extensionMode: 1,
			storageUri: { fsPath: "" },
		} as unknown as vscode.ExtensionContext

		let manager: MarketplaceManager

		beforeEach(() => {
			// Create a new manager instance with the mock context for each test
			manager = new MarketplaceManager(mockContext)
		})

		it("should correctly filter items by search term", () => {
			const items: MarketplaceItem[] = [
				{
					id: "test-item-1",
					name: "Test Item 1",
					description: "First test item",
					version: "zxc",
					type: "mode",
					url: "test1",
					repoUrl: "test1",
				},
				{
					id: "another-item",
					name: "Another Item",
					description: "Second item",
					version: "zxc",
					type: "mode",
					url: "test2",
					repoUrl: "test2",
				},
			]

			const filtered = manager.filterItems(items, { search: "test" })
			expect(filtered).toHaveLength(1)
			expect(filtered[0].name).toBe("Test Item 1")
			expect(filtered[0].matchInfo?.matched).toBe(true)
		})

		it("should correctly filter items by type", () => {
			const items: MarketplaceItem[] = [
				{
					id: "mode-item",
					name: "Mode Item",
					description: "A mode",
					version: "zxc",
					type: "mode",
					url: "test1",
					repoUrl: "test1",
				},
				{
					id: "server-item",
					name: "Server Item",
					description: "A server",
					version: "zxc",
					type: "mcp",
					url: "test2",
					repoUrl: "test2",
				},
			]

			const filtered = manager.filterItems(items, { type: "mode" })
			expect(filtered).toHaveLength(1)
			expect(filtered[0].name).toBe("Mode Item")
			expect(filtered[0].matchInfo?.matchReason?.typeMatch).toBe(true)
		})

		it("should preserve original items when filtering", () => {
			const items: MarketplaceItem[] = [
				{
					id: "test-item-1",
					name: "Test Item 1",
					description: "First test item",
					version: "zxc",
					type: "mode",
					url: "test1",
					repoUrl: "test1",
				},
				{
					id: "another-item",
					name: "Another Item",
					description: "Second item",
					version: "zxc",
					type: "mode",
					url: "test2",
					repoUrl: "test2",
				},
			]

			const originalItemsJson = JSON.stringify(items)
			manager.filterItems(items, { search: "test" })
			expect(JSON.stringify(items)).toBe(originalItemsJson)
		})
	})

	let manager: MarketplaceManager

	beforeEach(() => {
		const context = {
			globalStorageUri: { fsPath: path.resolve(__dirname, "../../../../mock/settings/path") },
		} as vscode.ExtensionContext
		manager = new MarketplaceManager(context)
	})

	describe("Type Filter Behavior", () => {
		let typeFilterTestItems: MarketplaceItem[]

		test("should include package with MCP server subcomponent when filtering by type 'mcp'", () => {
			const items: MarketplaceItem[] = [
				{
					id: "data-platform-package",
					name: "Data Platform Package",
					description: "A package containing MCP servers",
					version: "zxc",
					type: "package" as MarketplaceItemType,
					url: "test/package",
					repoUrl: "https://example.com",
					items: [
						{
							type: "mcp" as MarketplaceItemType,
							path: "test/server",
							metadata: {
								name: "Data Validator",
								description: "An MCP server",
								version: "1.0.0",
								type: "mcp" as MarketplaceItemType,
							},
						},
					],
				},
				{
					id: "standalone-server",
					name: "Standalone Server",
					description: "A standalone MCP server",
					version: "zxc",
					type: "mcp" as MarketplaceItemType,
					url: "test/server",
					repoUrl: "https://example.com",
				},
			]

			const filtered = manager.filterItems(items, { type: "mcp" })
			expect(filtered.length).toBe(2)
			expect(filtered.map((item) => item.name)).toContain("Data Platform Package")
			expect(filtered.map((item) => item.name)).toContain("Standalone Server")

			// Verify package is included because of its MCP server subcomponent
			const pkg = filtered.find((item) => item.name === "Data Platform Package")
			expect(pkg?.matchInfo?.matched).toBe(true)
			expect(pkg?.matchInfo?.matchReason?.hasMatchingSubcomponents).toBe(true)
			expect(pkg?.items?.[0].matchInfo?.matched).toBe(true)
			expect(pkg?.items?.[0].matchInfo?.matchReason?.typeMatch).toBe(true)
		})

		test("should include package when filtering by subcomponent type", () => {
			const items: MarketplaceItem[] = [
				{
					id: "data-platform-package",
					name: "Data Platform Package",
					description: "A package containing MCP servers",
					version: "zxc",
					type: "package" as MarketplaceItemType,
					url: "test/package",
					repoUrl: "https://example.com",
					items: [
						{
							type: "mcp" as MarketplaceItemType,
							path: "test/server",
							metadata: {
								name: "Data Validator",
								description: "An MCP server",
								version: "1.0.0",
								type: "mcp" as MarketplaceItemType,
							},
						},
					],
				},
			]

			const filtered = manager.filterItems(items, { type: "mcp" })
			expect(filtered.length).toBe(1)
			expect(filtered[0].name).toBe("Data Platform Package")
			expect(filtered[0].matchInfo?.matched).toBe(true)
			expect(filtered[0].items?.[0].matchInfo?.matched).toBe(true)
			expect(filtered[0].items?.[0].matchInfo?.matchReason?.typeMatch).toBe(true)
		})

		beforeEach(() => {
			// Create test items
			typeFilterTestItems = [
				{
					id: "test-package",
					name: "Test Package",
					description: "A test package",
					version: "zxc",
					type: "package",
					url: "test/package",
					repoUrl: "https://example.com",
					items: [
						{
							type: "mode",
							path: "test/mode",
							metadata: {
								name: "Test Mode",
								description: "A test mode",
								version: "1.0.0",
								type: "mode",
							},
						},
						{
							type: "mcp",
							path: "test/server",
							metadata: {
								name: "Test Server",
								description: "A test server",
								version: "1.0.0",
								type: "mcp",
							},
						},
					],
				},
				{
					id: "test-mode",
					name: "Test Mode",
					description: "A standalone test mode",
					version: "zxc",
					type: "mode",
					url: "test/standalone-mode",
					repoUrl: "https://example.com",
				},
			]
		})

		// Concurrency Control tests moved to their own describe block

		test("should include package when filtering by its own type", () => {
			// Filter by package type
			const filtered = manager.filterItems(typeFilterTestItems, { type: "package" })

			// Should include the package
			expect(filtered.length).toBe(1)
			expect(filtered[0].name).toBe("Test Package")
			expect(filtered[0].matchInfo?.matched).toBe(true)
			expect(filtered[0].matchInfo?.matchReason?.typeMatch).toBe(true)
		})

		// Note: The test "should include package when filtering by subcomponent type" is already covered by
		// the test "should work with type filter and localization together" in the filterItems with subcomponents section

		test("should not include package when filtering by type with no matching subcomponents", () => {
			// Create a package with no matching subcomponents
			const noMatchPackage: MarketplaceItem = {
				id: "no-match-package",
				name: "No Match Package",
				description: "A package with no matching subcomponents",
				version: "zxc",
				type: "package",
				url: "test/no-match",
				repoUrl: "https://example.com",
				items: [
					{
						type: "prompt",
						path: "test/prompt",
						metadata: {
							name: "Test Prompt",
							description: "A test prompt",
							version: "1.0.0",
							type: "prompt",
						},
					},
				],
			}

			// Filter by mode type
			const filtered = manager.filterItems([noMatchPackage], { type: "mode" })

			// Should not include the package
			expect(filtered.length).toBe(0)
		})

		test("should handle package with no subcomponents", () => {
			// Create a package with no subcomponents
			const noSubcomponentsPackage: MarketplaceItem = {
				id: "no-subcomponents-package",
				name: "No Subcomponents Package",
				description: "A package with no subcomponents",
				version: "zxc",
				type: "package",
				url: "test/no-subcomponents",
				repoUrl: "https://example.com",
			}

			// Filter by mode type
			const filtered = manager.filterItems([noSubcomponentsPackage], { type: "mode" })

			// Should not include the package
			expect(filtered.length).toBe(0)
		})

		describe("Consistency with Search Term Behavior", () => {
			let consistencyTestItems: MarketplaceItem[]

			beforeEach(() => {
				// Create test items
				consistencyTestItems = [
					{
						id: "test-package",
						name: "Test Package",
						description: "A test package",
						version: "zxc",
						type: "package",
						url: "test/package",
						repoUrl: "https://example.com",
						items: [
							{
								type: "mode",
								path: "test/mode",
								metadata: {
									name: "Test Mode",
									description: "A test mode",
									version: "1.0.0",
									type: "mode",
								},
							},
						],
					},
				]
			})

			test("should behave consistently with search term for packages", () => {
				// Filter by type
				const typeFiltered = manager.filterItems(consistencyTestItems, { type: "package" })

				// Filter by search term that matches the package
				const searchFiltered = manager.filterItems(consistencyTestItems, { search: "test package" })

				// Both should include the package
				expect(typeFiltered.length).toBe(1)
				expect(searchFiltered.length).toBe(1)

				// Both should mark the package as matched
				expect(typeFiltered[0].matchInfo?.matched).toBe(true)
				expect(searchFiltered[0].matchInfo?.matched).toBe(true)
			})

			test("should behave consistently with search term for subcomponents", () => {
				// Filter by type that matches a subcomponent
				const typeFiltered = manager.filterItems(consistencyTestItems, { type: "mode" })

				// Filter by search term that matches a subcomponent
				const searchFiltered = manager.filterItems(consistencyTestItems, { search: "test mode" })

				// Both should include the package
				expect(typeFiltered.length).toBe(1)
				expect(searchFiltered.length).toBe(1)

				// Both should mark the package as matched
				expect(typeFiltered[0].matchInfo?.matched).toBe(true)
				expect(searchFiltered[0].matchInfo?.matched).toBe(true)

				// Both should mark the subcomponent as matched
				expect(typeFiltered[0].items?.[0].matchInfo?.matched).toBe(true)
				expect(searchFiltered[0].items?.[0].matchInfo?.matched).toBe(true)
			})
		})
	})

	describe("sortItems with subcomponents", () => {
		const testItems: MarketplaceItem[] = [
			{
				id: "b-package",
				name: "B Package",
				description: "Package B",
				type: "package",
				version: "1.0.0",
				url: "/test/b",
				repoUrl: "https://example.com",
				items: [
					{
						type: "mode",
						path: "modes/y",
						metadata: {
							name: "Y Mode",
							description: "Mode Y",
							type: "mode",
							version: "1.0.0",
						},
						lastUpdated: "2025-04-13T09:00:00-07:00",
					},
					{
						type: "mode",
						path: "modes/x",
						metadata: {
							name: "X Mode",
							description: "Mode X",
							type: "mode",
							version: "1.0.0",
						},
						lastUpdated: "2025-04-13T09:00:00-07:00",
					},
				],
			},
			{
				id: "a-package",
				name: "A Package",
				description: "Package A",
				type: "package",
				version: "1.0.0",
				url: "/test/a",
				repoUrl: "https://example.com",
				items: [
					{
						type: "mode",
						path: "modes/z",
						metadata: {
							name: "Z Mode",
							description: "Mode Z",
							type: "mode",
							version: "1.0.0",
						},
						lastUpdated: "2025-04-13T08:00:00-07:00",
					},
				],
			},
		]

		it("should sort parent items while preserving subcomponents", () => {
			const sorted = manager.sortItems(testItems, "name", "asc")
			expect(sorted[0].name).toBe("A Package")
			expect(sorted[1].name).toBe("B Package")
			expect(sorted[0].items![0].metadata!.name).toBe("Z Mode")
			expect(sorted[1].items![0].metadata!.name).toBe("Y Mode")
		})

		it("should sort subcomponents within parents", () => {
			const sorted = manager.sortItems(testItems, "name", "asc", true)
			expect(sorted[1].items![0].metadata!.name).toBe("X Mode")
			expect(sorted[1].items![1].metadata!.name).toBe("Y Mode")
		})

		it("should preserve subcomponent order when sortSubcomponents is false", () => {
			const sorted = manager.sortItems(testItems, "name", "asc", false)
			expect(sorted[1].items![0].metadata!.name).toBe("Y Mode")
			expect(sorted[1].items![1].metadata!.name).toBe("X Mode")
		})

		it("should handle empty subcomponents when sorting", () => {
			const itemsWithEmpty = [
				...testItems,
				{
					id: "c-package",
					name: "C Package",
					description: "Package C",
					type: "package" as const,
					version: "1.0.0",
					url: "/test/c",
					repoUrl: "https://example.com",
					items: [],
				} as MarketplaceItem,
			]
			const sorted = manager.sortItems(itemsWithEmpty, "name", "asc")
			expect(sorted[2].name).toBe("C Package")
			expect(sorted[2].items).toHaveLength(0)
		})
	})

	describe("filterItems with real data", () => {
		it("should return all subcomponents with match info", () => {
			const testItems: MarketplaceItem[] = [
				{
					id: "data-platform-package",
					name: "Data Platform Package",
					description: "A test platform",
					type: "package",
					version: "1.0.0",
					url: "/test/data-platform",
					repoUrl: "https://example.com",
					items: [
						{
							type: "mcp",
							path: "mcps/data-validator",
							metadata: {
								name: "Data Validator",
								description: "An MCP server for validating data quality",
								type: "mcp",
								version: "1.0.0",
							},
							lastUpdated: "2025-04-13T10:00:00-07:00",
						},
						{
							type: "mode",
							path: "modes/task-runner",
							metadata: {
								name: "Task Runner",
								description: "A mode for running tasks",
								type: "mode",
								version: "1.0.0",
							},
							lastUpdated: "2025-04-13T10:00:00-07:00",
						},
					],
				},
			]

			// Search for "data validator"
			const filtered = manager.filterItems(testItems, { search: "data validator" })

			// Verify package is returned
			expect(filtered.length).toBe(1)
			const pkg = filtered[0]

			// Verify all subcomponents are returned
			expect(pkg.items?.length).toBe(2)

			// Verify matching subcomponent has correct matchInfo
			const validator = pkg.items?.find((item) => item.metadata?.name === "Data Validator")
			expect(validator?.matchInfo).toEqual({
				matched: true,
				matchReason: {
					nameMatch: true,
					descriptionMatch: false,
				},
			})

			// Verify non-matching subcomponent has correct matchInfo
			const runner = pkg.items?.find((item) => item.metadata?.name === "Task Runner")
			expect(runner?.matchInfo).toEqual({
				matched: false,
			})

			// Verify package has matchInfo indicating it contains matches
			expect(pkg.matchInfo).toEqual({
				matched: true,
				matchReason: {
					nameMatch: false,
					descriptionMatch: false,
					hasMatchingSubcomponents: true,
				},
			})
		})
	})
})

describe("Source Attribution", () => {
	let manager: MarketplaceManager

	beforeEach(() => {
		const mockContext = {
			globalStorageUri: { fsPath: "/test/path" },
		} as vscode.ExtensionContext
		manager = new MarketplaceManager(mockContext)
	})

	it("should maintain source attribution for items", async () => {
		const sources: MarketplaceSource[] = [
			{ url: "https://github.com/test/repo1", name: "Source 1", enabled: true },
			{ url: "https://github.com/test/repo2", name: "Source 2", enabled: true },
		]

		// Mock getRepositoryData to return different items for each source
		jest.spyOn(manager as any, "getRepositoryData")
			.mockImplementationOnce(() =>
				Promise.resolve({
					metadata: { name: "test", description: "test", version: "1.0.0" },
					items: [
						{
							id: "item-1",
							name: "Item 1",
							type: "mode",
							description: "Test item",
							url: "test1",
							repoUrl: "https://github.com/test/repo1",
						},
					],
					url: sources[0].url,
				}),
			)
			.mockImplementationOnce(() =>
				Promise.resolve({
					metadata: { name: "test", description: "test", version: "1.0.0" },
					items: [],
					url: sources[1].url,
				}),
			)

		const result = await manager.getMarketplaceItems(sources)

		// Verify items maintain their source attribution
		expect(result.items).toHaveLength(1)
		expect(result.items[0].sourceName).toBe("Source 1")
		expect(result.items[0].sourceUrl).toBe("https://github.com/test/repo1")
	})
})

describe("Concurrency Control", () => {
	let manager: MarketplaceManager

	beforeEach(() => {
		const mockContext = {
			globalStorageUri: { fsPath: "/test/path" },
		} as vscode.ExtensionContext
		manager = new MarketplaceManager(mockContext)
	})

	it("should not allow concurrent operations on the same source", async () => {
		const source: MarketplaceSource = {
			url: "https://github.com/test/repo",
			enabled: true,
		}

		// Mock getRepositoryData to return a resolved promise immediately
		const getRepoSpy = jest.spyOn(manager as any, "getRepositoryData").mockImplementation(() =>
			Promise.resolve({
				metadata: { name: "test", description: "test", version: "1.0.0" },
				items: [],
				url: source.url,
			} as MarketplaceRepository),
		)

		// Start two concurrent operations
		const operation1 = manager.getMarketplaceItems([source])
		const operation2 = manager.getMarketplaceItems([source])

		// Wait for both to complete
		// const [result1, result2] =
		await Promise.all([operation1, operation2])

		// Verify getRepositoryData was only called once
		expect(getRepoSpy).toHaveBeenCalledTimes(1)

		// Clean up
		getRepoSpy.mockRestore()
	})

	it("should not allow metadata scanning during git operations", async () => {
		try {
			const source1: MarketplaceSource = {
				url: "https://github.com/test/repo1",
				enabled: true,
			}
			const source2: MarketplaceSource = {
				url: "https://github.com/test/repo2",
				enabled: true,
			}

			let isGitOperationActive = false
			let metadataScanDuringGit = false

			// Mock git operation to resolve immediately
			// const fetchRepoSpy =
			jest.spyOn(GitFetcher.prototype, "fetchRepository").mockImplementation(async () => {
				isGitOperationActive = true
				isGitOperationActive = false
				return {
					metadata: { name: "test", description: "test", version: "1.0.0" },
					items: [],
					url: source1.url,
				}
			})

			// Mock metadata scanner to check if git operation is active
			// const scanDirSpy =
			jest.spyOn(MetadataScanner.prototype, "scanDirectory").mockImplementation(async () => {
				if (isGitOperationActive) {
					metadataScanDuringGit = true
				}
				return []
			})

			// Process both sources
			await manager.getMarketplaceItems([source1, source2])

			// Verify metadata scanning didn't occur during git operations
			expect(metadataScanDuringGit).toBe(false)
		} finally {
			jest.clearAllTimers()
		}
	})

	it("should queue metadata scans and process them sequentially", async () => {
		const sources: MarketplaceSource[] = [
			{ url: "https://github.com/test/repo1", enabled: true },
			{ url: "https://github.com/test/repo2", enabled: true },
			{ url: "https://github.com/test/repo3", enabled: true },
		]

		let activeScans = 0
		let maxConcurrentScans = 0

		// Create a mock MetadataScanner that resolves immediately
		const mockScanner = new MetadataScanner()
		const scanDirectorySpy = jest.spyOn(mockScanner, "scanDirectory").mockImplementation(async () => {
			activeScans++
			maxConcurrentScans = Math.max(maxConcurrentScans, activeScans)
			activeScans--
			return Promise.resolve([])
		})

		// Create a mock GitFetcher that uses our mock scanner
		const mockGitFetcher = new GitFetcher({
			globalStorageUri: { fsPath: "/test/path" },
		} as vscode.ExtensionContext)

		// Replace GitFetcher's metadataScanner with our mock
		;(mockGitFetcher as any).metadataScanner = mockScanner

		// Mock GitFetcher's fetchRepository to trigger metadata scanning
		const fetchRepoSpy = jest
			.spyOn(mockGitFetcher, "fetchRepository")
			.mockImplementation(async (repoUrl: string) => {
				// Call scanDirectory through our mock scanner
				await mockScanner.scanDirectory("/test/path", repoUrl)

				return Promise.resolve({
					metadata: { name: "test", description: "test", version: "1.0.0" },
					items: [],
					url: repoUrl,
				})
			})

		// Replace the GitFetcher instance in the manager
		;(manager as any).gitFetcher = mockGitFetcher

		// Process all sources
		await manager.getMarketplaceItems(sources)

		// Verify scans were called and only one was active at a time
		expect(scanDirectorySpy).toHaveBeenCalledTimes(sources.length)
		expect(maxConcurrentScans).toBe(1)

		// Clean up
		scanDirectorySpy.mockRestore()
		fetchRepoSpy.mockRestore()
	})
})
