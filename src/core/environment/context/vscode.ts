import path from "path"
import * as vscode from "vscode"

import type { Task } from "../../task/Task"

export async function getVscodeEditorContext(cline: Task) {
	const state = await cline.providerRef.deref()?.getState()
	const { maxWorkspaceFiles = 200 } = state ?? {}

	// Get visible files in the editor
	const visibleFilePaths = vscode.window.visibleTextEditors
		?.map((editor) => editor.document?.uri?.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(cline.cwd, absolutePath))
		.slice(0, maxWorkspaceFiles)

	const allowedVisibleFiles = cline.rooIgnoreController
		? cline.rooIgnoreController.filterPaths(visibleFilePaths)
		: visibleFilePaths.map((p) => p.toPosix())

	const visibleFiles =
		allowedVisibleFiles?.length > 0
			? {
					file: allowedVisibleFiles.map((p) => ({ "@path": p })),
				}
			: undefined

	// Get open tabs (high-frequency data - using compact representation)
	const { maxOpenTabsContext } = state ?? {}
	const maxTabs = maxOpenTabsContext ?? 20
	const openTabPaths = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(cline.cwd, absolutePath).toPosix())
		.slice(0, maxTabs)

	const allowedOpenTabs = cline.rooIgnoreController
		? cline.rooIgnoreController.filterPaths(openTabPaths)
		: openTabPaths

	const openTabs =
		allowedOpenTabs?.length > 0
			? {
					t: allowedOpenTabs.map((p) => ({ "@p": p })),
				}
			: undefined

	return { visibleFiles, openTabs }
}
