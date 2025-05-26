import * as path from "path"
import { jest } from "@jest/globals"
import { Dirent, Stats, PathLike } from "fs"
import { FileHandle } from "fs/promises"
import { MetadataScanner } from "../MetadataScanner"
import { SimpleGit } from "simple-git"

// Mock fs/promises module
jest.mock("fs/promises")
import { stat, readdir, readFile } from "fs/promises"

// Create typed mocks
const mockStat = jest.mocked(stat)
const mockReaddir = jest.mocked(readdir)
const mockReadFile = jest.mocked(readFile)

// Helper function to normalize paths for test assertions
const normalizePath = (p: string) => p.replace(/\\/g, "/")

// Create mock git functions with proper types
const mockGitRaw = jest.fn<() => Promise<string>>()
const mockGitRevparse = jest.fn<() => Promise<string>>()

describe("MetadataScanner", () => {
	let metadataScanner: MetadataScanner
	const mockBasePath = "/test/repo"
	const mockRepoUrl = "https://example.com/repo"

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Create mock git instance with default date
		const mockGit = {
			raw: mockGitRaw.mockResolvedValue("2025-04-13T09:00:00-07:00"),
			revparse: mockGitRevparse.mockResolvedValue("main"),
		} as unknown as SimpleGit

		// Initialize MetadataScanner with mock git
		metadataScanner = new MetadataScanner(mockGit)
	})

	describe("Basic Metadata Scanning", () => {
		it.skip("should discover components with English metadata", async () => {
			// Setup mock implementations
			const mockStats = {
				isDirectory: () => true,
				isFile: () => true,
				mtime: new Date("2025-04-13T09:00:00-07:00"),
			} as Stats

			// Setup Dirent objects
			const componentDirDirent: Dirent = {
				name: "component1",
				isDirectory: () => true,
				isFile: () => false,
			} as Dirent
			const metadataFileDirent: Dirent = {
				name: "metadata.en.yml",
				isDirectory: () => false,
				isFile: () => true,
			} as Dirent

			// Setup mock implementations
			mockStat.mockResolvedValue(mockStats)

			mockReaddir.mockImplementation(async (dirPath: PathLike, options?: any) => {
				const normalizedP = normalizePath(dirPath.toString())
				if (normalizedP === normalizePath(mockBasePath)) {
					return (options?.withFileTypes ? [componentDirDirent] : ["component1"]) as any
				}
				if (normalizedP === normalizePath(path.join(mockBasePath, "component1"))) {
					return (options?.withFileTypes ? [metadataFileDirent] : ["metadata.en.yml"]) as any
				}
				return (options?.withFileTypes ? [] : []) as any
			})

			mockReadFile.mockImplementation(async (path: any, options?: any) => {
				const content = Buffer.from(
					`
name: Test Component
description: A test component
type: mcp
version: 1.0.0
sourceUrl: https://example.com/component1
`.trim(),
				)
				return options?.encoding ? content.toString() : (content as any)
			})

			// Scan directory and verify results
			const result = await metadataScanner.scanDirectory(mockBasePath, mockRepoUrl)

			expect(result).toHaveLength(1)
			const component = result[0]
			expect(component).toBeDefined()
			expect(component.name).toBe("Test Component")
			expect(component.description).toBe("A test component")
			expect(component.type).toBe("mcp")
			expect(component.version).toBe("1.0.0")
			expect(component.url).toBe("https://example.com/repo/tree/main/component1")
			expect(component.path).toBe("component1")
			expect(component.sourceUrl).toBe("https://example.com/component1")
			expect(component.repoUrl).toBe(mockRepoUrl)
			expect(component.items).toEqual([])
			expect(component.lastUpdated).toBe("2025-04-13T09:00:00-07:00")
		})

		it.skip("should handle missing sourceUrl in metadata", async () => {
			const mockDirents = [
				{
					name: "component2",
					isDirectory: () => true,
					isFile: () => false,
				},
				{
					name: "metadata.en.yml",
					isDirectory: () => false,
					isFile: () => true,
				},
			] as Dirent[]

			const mockStats = {
				isDirectory: () => true,
				isFile: () => true,
				mtime: new Date(),
			} as Stats

			// Setup mock implementations
			mockStat.mockResolvedValue(mockStats)

			mockReaddir.mockImplementation(async (path: PathLike, options?: any) => {
				const pathStr = path.toString()
				if (pathStr.includes("/component2/")) {
					return [] as any
				}
				return mockDirents.map((d) => d.name) as any
			})

			mockReadFile.mockImplementation(async (path: any, options?: any) => {
				const content = Buffer.from(
					`
name: Test Component 2
description: A test component without sourceUrl
type: mcp
version: 1.0.0
`.trim(),
				)
				return options?.encoding ? content.toString() : (content as any)
			})

			const result = await metadataScanner.scanDirectory(mockBasePath, mockRepoUrl)

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("Test Component 2")
			expect(result[0].type).toBe("mcp")
			expect(result[0].url).toBe("https://example.com/repo/tree/main/component2")
			expect(result[0].path).toBe("component2")
			expect(result[0].sourceUrl).toBeUndefined()
		})
	})
})
