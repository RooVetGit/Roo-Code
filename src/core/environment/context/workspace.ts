import path from "path"
import os from "os"

import { listFiles } from "../../../services/glob/list-files"
import { arePathsEqual } from "../../../utils/path"
import { formatResponse } from "../../prompts/responses"
import type { Task } from "../../task/Task"

export async function getWorkspaceContext(cline: Task, includeFileDetails: boolean) {
	if (!includeFileDetails) {
		return {}
	}
	const state = await cline.providerRef.deref()?.getState()
	const { maxWorkspaceFiles = 200, showRooIgnoredFiles = true } = state ?? {}

	const isDesktop = arePathsEqual(cline.cwd, path.join(os.homedir(), "Desktop"))
	const workspaceData: any = { "@directory": cline.cwd.toPosix() }

	if (isDesktop) {
		workspaceData.note = "Desktop files not shown automatically. Use list_files to explore if needed."
	} else if (maxWorkspaceFiles === 0) {
		workspaceData.note = "Workspace files context disabled. Use list_files to explore if needed."
	} else {
		const [files, didHitLimit] = await listFiles(cline.cwd, true, maxWorkspaceFiles)
		const formattedFilesList = formatResponse.formatFilesList(
			cline.cwd,
			files,
			didHitLimit,
			cline.rooIgnoreController,
			showRooIgnoredFiles,
		)

		if (formattedFilesList && formattedFilesList !== "No files found.") {
			const fileLines = formattedFilesList.split("\n").filter((line) => line.trim() !== "")
			const fileObjects: any[] = []
			const dirObjects: any[] = []

			fileLines.forEach((line) => {
				if (line.endsWith("/")) {
					dirObjects.push({ "@path": line })
				} else if (!line.includes("File list truncated")) {
					fileObjects.push({ "@path": line })
				}
			})

			if (fileObjects.length > 0) workspaceData.file = fileObjects
			if (dirObjects.length > 0) workspaceData.directory = dirObjects
			if (didHitLimit) {
				workspaceData.note =
					"File list truncated. Use list_files on specific subdirectories if you need to explore further."
			}
		}
	}

	return { workspace: workspaceData }
}
