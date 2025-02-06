import * as vscode from "vscode"
import { getRepo, getStagedDiff, getStagedStatus, Status } from "../vsCodeGit"

// Mock vscode module
jest.mock("vscode", () => ({
	extensions: {
		getExtension: jest.fn(),
	},
	Uri: {
		file: jest.fn().mockImplementation((path) => {
			// Return a mock object that looks like vscode.Uri
			return { fsPath: path }
		}),
	},
}))
const diffResult: string = "mock diff output"
// Mock Git repository interface implementation
const createMockRepository = (indexChanges: { status: Status; uri: vscode.Uri }[]): any => ({
	diff: jest.fn().mockResolvedValue(indexChanges.length > 0 ? diffResult : ""), // Simulate diff output
	state: {
		indexChanges: indexChanges.map((change) => ({
			status: change.status,
			uri: change.uri,
		})),
	},
	inputBox: { value: "test message" },
})

describe("VS Code Git Integration utils", () => {
	const mockGitExtension = {
		getAPI: jest.fn().mockReturnValue({
			repositories: [createMockRepository([])],
		}),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("getRepo", () => {
		it("should return null when Git extension is not installed", () => {
			;(vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined)
			expect(getRepo()).toBeNull()
		})

		it("should return null when no repositories exist", () => {
			;(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				exports: {
					getAPI: jest.fn().mockReturnValue({ repositories: [] }),
				},
			})
			expect(getRepo()).toBeNull()
		})

		it("should return first repository when available", () => {
			const mockRepo = createMockRepository([])
			;(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				exports: mockGitExtension,
			})
			expect(getRepo()).toEqual(expect.any(Object)) // Ensure it returns a object
		})
	})

	describe("getStagedDiff", () => {
		it("should return staged diff when there are staged changes", async () => {
			const mockRepo = createMockRepository([
				{ status: Status.INDEX_MODIFIED, uri: vscode.Uri.file("file1.txt") },
			])
			;(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				exports: {
					getAPI: jest.fn().mockReturnValue({ repositories: [mockRepo] }),
				},
			})

			const result = await getStagedDiff(mockRepo)
			expect(result).toBe(diffResult) // Expecting diff output
			expect(mockRepo.diff).toHaveBeenCalledWith(true) // Ensure diff method is called with staged = true
		})

		it("should Empty string when no staged changes", async () => {
			const mockRepo = createMockRepository([]) // No staged changes
			;(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
				exports: {
					getAPI: jest.fn().mockReturnValue({ repositories: [mockRepo] }),
				},
			})

			const result = await getStagedDiff(mockRepo)
			expect(result).toBe("") // No diff for no staged changes
		})
	})

	describe("getStagedStatus", () => {
		it("should correctly format staged changes", () => {
			const mockRepo = createMockRepository([
				{ status: Status.INDEX_MODIFIED, uri: vscode.Uri.file("file1.txt") },
				{ status: Status.INDEX_ADDED, uri: vscode.Uri.file("file2.txt") },
				{ status: Status.INDEX_DELETED, uri: vscode.Uri.file("file3.txt") },
				{ status: Status.INDEX_RENAMED, uri: vscode.Uri.file("file4.txt") },
				{ status: Status.INDEX_COPIED, uri: vscode.Uri.file("file5.txt") },
				{ status: 99 as Status, uri: vscode.Uri.file("unknown.txt") },
			])

			const expected = [
				"M - file1.txt",
				"A - file2.txt",
				"D - file3.txt",
				"R - file4.txt",
				"C - file5.txt",
				"? - unknown.txt",
			].join("\n")

			expect(getStagedStatus(mockRepo)).toBe(expected) // Expect correct formatted string
		})

		it("should return an empty string when no staged changes", () => {
			const mockRepo = createMockRepository([])
			expect(getStagedStatus(mockRepo)).toBe("") // Empty string for no staged changes
		})
	})
})
