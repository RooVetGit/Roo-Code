import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { promises as fs } from "fs"
import * as path from "path"
import * as os from "os"
import { getGitRepositoryInfo, getWorkspaceGitInfo } from "../git"
import * as vscode from "vscode"

// Mock vscode
jest.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		],
	},
}))

// Mock fs
jest.mock("fs", () => ({
	promises: {
		access: jest.fn(),
		readFile: jest.fn(),
	},
}))

const mockFs = fs as jest.Mocked<typeof fs>

describe("git utilities", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("getGitRepositoryInfo", () => {
		it("should return empty object when .git directory doesn't exist", async () => {
			mockFs.access.mockRejectedValue(new Error("ENOENT"))

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result).toEqual({})
			expect(mockFs.access).toHaveBeenCalledWith(path.join("/test/workspace", ".git"))
		})

		it("should extract git repository information from config file", async () => {
			const mockConfig = `
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = https://github.com/user/test-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
`
			const mockHead = "ref: refs/heads/main\n"

			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile
				.mockResolvedValueOnce(mockConfig) // config file
				.mockResolvedValueOnce(mockHead) // HEAD file

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result).toEqual({
				repositoryUrl: "https://github.com/user/test-repo.git",
				repositoryName: "user/test-repo",
				defaultBranch: "main",
			})
		})

		it("should sanitize git URLs with credentials", async () => {
			const mockConfig = `
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = https://username:token123@github.com/user/test-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
`
			const mockHead = "ref: refs/heads/main\n"

			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile
				.mockResolvedValueOnce(mockConfig) // config file
				.mockResolvedValueOnce(mockHead) // HEAD file

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result.repositoryUrl).toBe("https://github.com/user/test-repo.git")
			expect(result.repositoryName).toBe("user/test-repo")
			expect(result.defaultBranch).toBe("main")
		})

		it("should handle SSH URLs correctly", async () => {
			const mockConfig = `
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = git@github.com:user/test-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
`
			const mockHead = "ref: refs/heads/main\n"

			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile
				.mockResolvedValueOnce(mockConfig) // config file
				.mockResolvedValueOnce(mockHead) // HEAD file

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result.repositoryUrl).toBe("git@github.com:user/test-repo.git")
			expect(result.repositoryName).toBe("user/test-repo")
			expect(result.defaultBranch).toBe("main")
		})

		it("should handle errors gracefully", async () => {
			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile.mockRejectedValue(new Error("Permission denied"))

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result).toEqual({})
		})

		it("should get branch from HEAD file when config doesn't have branch info", async () => {
			const mockConfig = `
[remote "origin"]
	url = https://github.com/user/test-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
`
			const mockHead = "ref: refs/heads/develop\n"

			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile.mockResolvedValueOnce(mockConfig).mockResolvedValueOnce(mockHead)

			const result = await getGitRepositoryInfo("/test/workspace")

			expect(result).toEqual({
				repositoryUrl: "https://github.com/user/test-repo.git",
				repositoryName: "user/test-repo",
				defaultBranch: "develop",
			})
		})
	})

	describe("getWorkspaceGitInfo", () => {
		it("should return empty object when no workspace folders exist", async () => {
			// Mock vscode to return no workspace folders
			;(vscode.workspace as any).workspaceFolders = undefined

			const result = await getWorkspaceGitInfo()

			expect(result).toEqual({})
		})

		it("should return git info for the first workspace folder", async () => {
			// Reset the workspace mock to ensure it has the expected workspace folders
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/mock/workspace",
					},
				},
			]

			const mockConfig = `
[remote "origin"]
	url = https://github.com/user/workspace-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
`
			const mockHead = "ref: refs/heads/main\n"

			mockFs.access.mockResolvedValue(undefined)
			mockFs.readFile
				.mockResolvedValueOnce(mockConfig) // config file
				.mockResolvedValueOnce(mockHead) // HEAD file

			const result = await getWorkspaceGitInfo()

			expect(result).toEqual({
				repositoryUrl: "https://github.com/user/workspace-repo.git",
				repositoryName: "user/workspace-repo",
				defaultBranch: "main",
			})
		})
	})
})
