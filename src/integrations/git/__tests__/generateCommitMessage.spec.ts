import * as vscode from "vscode"
import { simpleGit, SimpleGit } from "simple-git"
import { generateCommitMessage } from "../generateCommitMessage"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { buildApiHandler } from "../../../api"
import * as fs from "fs/promises"
import { t } from "../../../i18n"

vi.mock("vscode", () => ({
	extensions: {
		getExtension: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		withProgress: vi.fn((options, task) => task()),
	},
	ProgressLocation: {
		Notification: 15,
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/repo",
				},
			},
		],
	},
}))

vi.mock("simple-git")
vi.mock("../../../core/config/ContextProxy")
vi.mock("../../../api")
vi.mock("fs/promises")
vi.mock("../../../i18n")

describe("generateCommitMessage", () => {
	let context: vscode.ExtensionContext
	let mockGit: any

	beforeEach(() => {
		vi.clearAllMocks()

		context = {
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
		} as any

		mockGit = {
			diff: vi.fn(),
			status: vi.fn().mockResolvedValue({ not_added: [] }),
		} as any

		vi.mocked(simpleGit).mockReturnValue(mockGit)

		const mockGitExtension = {
			activate: vi.fn().mockResolvedValue(undefined),
			exports: {
				getAPI: vi.fn().mockReturnValue({
					repositories: [
						{
							rootUri: { fsPath: "/test/repo" },
							inputBox: { value: "" },
						},
					],
				}),
			},
		}
		vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockGitExtension as any)

		vi.mocked(ContextProxy.getInstance).mockResolvedValue({
			getProviderSettings: vi.fn().mockReturnValue({ provider: "test-provider" }),
			getGlobalSettings: vi.fn().mockReturnValue({ language: "en", commitLanguage: "en" }),
		} as any)

		const mockProvider = {
			getModel: vi.fn().mockReturnValue({ id: "test-model" }),
			createMessage: vi.fn().mockImplementation(async function* () {
				yield { type: "text", text: "feat: Test commit" }
			}),
		}
		vi.mocked(buildApiHandler).mockReturnValue(mockProvider as any)
		vi.mocked(t).mockImplementation((key) => key)
	})

	test("should show error if git extension is not found", async () => {
		vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined)
		await generateCommitMessage(context)
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Git extension not found.")
	})

	test("should show error if no git repository is found", async () => {
		const mockGitExtension = {
			activate: vi.fn().mockResolvedValue(undefined),
			exports: {
				getAPI: vi.fn().mockReturnValue({ repositories: [] }),
			},
		}
		vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockGitExtension as any)

		await generateCommitMessage(context)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No Git repository found.")
	})

	test("should show info if no changes are found", async () => {
		mockGit.diff.mockResolvedValue("")
		mockGit.status.mockResolvedValue({ not_added: [] })

		await generateCommitMessage(context)

		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("No changes found.")
	})

	test("should show error if AI provider is not configured", async () => {
		vi.mocked(ContextProxy.getInstance).mockResolvedValue({
			getProviderSettings: vi.fn().mockReturnValue(null),
		} as any)

		mockGit.diff.mockResolvedValue("diff --git a/file.txt b/file.txt")
		await generateCommitMessage(context)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("AI provider not configured.")
	})

	test("should generate commit message for tracked files", async () => {
		const diff = "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new"
		mockGit.diff.mockResolvedValue(diff)

		await generateCommitMessage(context)

		const api = vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)
		expect(api.repositories[0].inputBox.value).toBe("feat: Test commit")
	})

	test("should generate commit message for untracked files", async () => {
		mockGit.diff.mockResolvedValue("")
		mockGit.status.mockResolvedValue({ not_added: ["new_file.txt"] })
		vi.mocked(fs.readFile).mockResolvedValue("new content")

		await generateCommitMessage(context)

		const api = vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)
		expect(api.repositories[0].inputBox.value).toBe("feat: Test commit")
	})

	test("should generate commit message for both tracked and untracked files", async () => {
		const diff = "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new"
		mockGit.diff.mockResolvedValue(diff)
		mockGit.status.mockResolvedValue({ not_added: ["new_file.txt"] })
		vi.mocked(fs.readFile).mockResolvedValue("new content")

		await generateCommitMessage(context)

		const api = vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)
		expect(api.repositories[0].inputBox.value).toBe("feat: Test commit")
	})

	test("should handle error when reading untracked file", async () => {
		mockGit.diff.mockResolvedValue("")
		mockGit.status.mockResolvedValue({ not_added: ["new_file.txt"] })
		vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		await generateCommitMessage(context)

		expect(consoleErrorSpy).toHaveBeenCalledWith("Could not read untracked file new_file.txt", expect.any(Error))
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("No changes found.")
		const api = vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)
		expect(api.repositories[0].inputBox.value).toBe("")
		consoleErrorSpy.mockRestore()
	})
})
