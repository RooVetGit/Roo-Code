import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

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
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		return JSON.parse(await fs.readFile(filePath, "utf8"))
	}

	return []
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	// Validate messages before saving to prevent data corruption
	if (!Array.isArray(messages)) {
		console.error(
			`[Roo-Debug] saveTaskMessages: Invalid messages format - expected array, got ${typeof messages}. TaskId: ${taskId}`,
		)
		throw new Error("Invalid messages format for saving")
	}

	// Log warning for unusually large conversations
	if (messages.length > 1000) {
		console.warn(
			`[Roo-Debug] saveTaskMessages: Saving large conversation with ${messages.length} messages. TaskId: ${taskId}`,
		)
	}

	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)

	// Log the save operation for debugging
	console.log(`[Roo-Debug] saveTaskMessages: Saving ${messages.length} UI messages to ${filePath}. TaskId: ${taskId}`)

	await safeWriteJson(filePath, messages)
}
