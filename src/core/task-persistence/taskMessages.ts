import { safeReadJson } from "../../utils/safeReadJson"
import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"

import type { ClineMessage } from "@roo-code/types"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)

	try {
		return await safeReadJson(filePath)
	} catch (error) {
		if (error.code !== "ENOENT") {
			console.error("Failed to read task messages:", error)
		}
		return []
	}
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages)
}
