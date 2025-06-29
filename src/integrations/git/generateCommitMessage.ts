import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { buildApiHandler } from "../../api"
import { t } from "../../i18n"
import { simpleGit, SimpleGit } from "simple-git"
import { ContextProxy } from "../../core/config/ContextProxy"
import { Anthropic } from "@anthropic-ai/sdk"

async function getGitApi(): Promise<any | undefined> {
	const extension = vscode.extensions.getExtension("vscode.git")
	if (!extension) {
		vscode.window.showErrorMessage("Git extension not found.")
		return
	}
	await extension.activate()
	return extension.exports.getAPI(1)
}

async function getChanges(git: SimpleGit, repoPath: string): Promise<string> {
	const trackedFilesDiff = await git.diff()
	const status = await git.status()
	const untrackedFiles = status.not_added

	let untrackedFilesContent = ""
	for (const file of untrackedFiles) {
		const filePath = path.join(repoPath, file)
		try {
			const content = await fs.readFile(filePath, "utf-8")
			untrackedFilesContent += `\n--- a/${file}\n+++ b/${file}\n${content}`
		} catch (e) {
			console.error(`Could not read untracked file ${file}`, e)
		}
	}

	return `${trackedFilesDiff}\n${untrackedFilesContent}`.trim()
}

function createPrompt(diff: string, language: string): string {
	return `Create a git commit message in ${language} from the following diff:\n${diff}.Remember to print only commit messages text without any extra markdown or content that would require special tools to display. Adhere to best git commit message practices. Remember to use ${language} in this commit message.`
}

export async function generateCommitMessage(context: vscode.ExtensionContext) {
	const gitApi = await getGitApi()
	if (!gitApi) {
		return
	}

	if (gitApi.repositories.length === 0) {
		vscode.window.showErrorMessage("No Git repository found.")
		return
	}

	const repoPath = gitApi.repositories[0].rootUri.fsPath
	const git = simpleGit(repoPath)
	const diff = await getChanges(git, repoPath)

	if (!diff) {
		vscode.window.showInformationMessage("No changes found.")
		return
	}

	const contextProxy = await ContextProxy.getInstance(context)
	const providerSettings = contextProxy.getProviderSettings()
	if (!providerSettings) {
		vscode.window.showErrorMessage("AI provider not configured.")
		return
	}
	const provider = buildApiHandler(providerSettings)
	const modelName = provider.getModel().id
	const settings = contextProxy.getGlobalSettings()
	const commitLanguage = settings.commitLanguage || settings.language || "en"
	const prompt = createPrompt(diff, commitLanguage)
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: prompt,
		},
	]

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: t("common:git.generatingCommitMessage", { modelName }),
			cancellable: false,
		},
		async () => {
			const stream = provider.createMessage("", messages, { taskId: "generate-commit" })

			let commitMessage = ""
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					commitMessage += chunk.text
				}
			}

			const finalMessage = commitMessage.trim()
			gitApi.repositories[0].inputBox.value = finalMessage
		},
	)
}
