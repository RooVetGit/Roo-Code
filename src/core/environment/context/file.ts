import type { Task } from "../../task/Task"

export function getFileContext(cline: Task) {
	const recentlyModifiedFiles = cline.fileContextTracker.getAndClearRecentlyModifiedFiles()
	if (recentlyModifiedFiles.length > 0) {
		return {
			recentlyModified: {
				file: recentlyModifiedFiles.map((p) => ({ "@path": p })),
			},
		}
	}
	return {}
}
