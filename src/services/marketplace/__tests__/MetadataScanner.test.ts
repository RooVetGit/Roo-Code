jest.mock("fs/promises", () => {
	const mockStat = jest.fn()
	const mockReaddir = jest.fn()
	const mockReadFile = jest.fn()
	return {
		stat: mockStat,
		readdir: mockReaddir,
		readFile: mockReadFile,
	}
})

import * as path from "path"
import { jest } from "@jest/globals"
import { Dirent, Stats } from "fs"
import { MetadataScanner } from "../MetadataScanner"
import { SimpleGit } from "simple-git"
import * as fs from "fs/promises"

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
		it("should discover components with English metadata", async () => {
			// Setup mock implementations
			const mockStats = {
				isDirectory: () => true,
				isFile: () => true,
				mtime: new Date(),
			} as Stats

			// Mock fs.promises methods using type assertions
			const mockedFs = jest.mocked(fs)
			mockedFs.stat.mockResolvedValue(mockStats)

			// Define specific Dirent objects
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

			// Refined mock implementation for fs.readdir
			;(mockedFs.readdir as any).mockImplementation(async (p: string, options?: any) => {
				const normalizedP = normalizePath(p)
				const normalizedBasePath = normalizePath(mockBasePath)
				const normalizedComponentPath = normalizePath(path.join(mockBasePath, "component1"))

				if (normalizedP === normalizedBasePath) {
					// For the base path, return only the component directory
					const baseDirents = [componentDirDirent]
					return options?.withFileTypes ? baseDirents : baseDirents.map((d) => d.name)
				} else if (normalizedP === normalizedComponentPath) {
					// For the component1 directory, return only the metadata file
					const componentDirents = [metadataFileDirent]
					return options?.withFileTypes ? componentDirents : componentDirents.map((d) => d.name)
				} else {
					// For any other path (deeper recursion), return empty
					return options?.withFileTypes ? [] : []
				}
			})

			mockedFs.readFile.mockResolvedValue(
				Buffer.from(`
name: Test Component
description: A test component
type: mcp
version: 1.0.0
sourceUrl: https://example.com/component1
`),
			)

			const items = await metadataScanner.scanDirectory(mockBasePath, mockRepoUrl)

			expect(items).toHaveLength(1)
			expect(items[0].name).toBe("Test Component")
			expect(items[0].type).toBe("mcp")
			expect(items[0].url).toBe("https://example.com/repo/tree/main/component1")
			expect(items[0].path).toBe("component1")
			expect(items[0].sourceUrl).toBe("https://example.com/component1")
		})
		it("should handle missing sourceUrl in metadata", async () => {
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

			const mockEmptyDirents = [] as Dirent[]
			const mockStats = {
				isDirectory: () => true,
				isFile: () => true,
				mtime: new Date(),
			} as Stats

			const mockedFs = jest.mocked(fs)
			mockedFs.stat.mockResolvedValue(mockStats)
			;(mockedFs.readdir as any).mockImplementation(async (path: any, options?: any) => {
				if (path.toString().includes("/component2/")) {
					return options?.withFileTypes ? mockEmptyDirents : []
				}
				return options?.withFileTypes ? mockDirents : mockDirents.map((d) => d.name)
			})
			mockedFs.readFile.mockResolvedValue(
				Buffer.from(`
name: Test Component 2
description: A test component without sourceUrl
type: mcp
version: 1.0.0
`),
			)

			const items = await metadataScanner.scanDirectory(mockBasePath, mockRepoUrl)

			expect(items).toHaveLength(1)
			expect(items[0].name).toBe("Test Component 2")
			expect(items[0].type).toBe("mcp")
			expect(items[0].url).toBe("https://example.com/repo/tree/main/component2")
			expect(items[0].path).toBe("component2")
			expect(items[0].sourceUrl).toBeUndefined()
		})
	})
})
