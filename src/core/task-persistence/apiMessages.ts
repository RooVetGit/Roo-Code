import * as path from "path"
import * as fs from "fs/promises"

import { Anthropic } from "@anthropic-ai/sdk"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ApiMessage = Anthropic.MessageParam & { ts?: number; isSummary?: boolean }

export async function readApiMessages({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		const parsedData = JSON.parse(fileContent)
		if (Array.isArray(parsedData) && parsedData.length === 0) {
			console.error(
				`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty. TaskId: ${taskId}, Path: ${filePath}`,
			)
		}
		return parsedData
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			const parsedData = JSON.parse(fileContent)
			if (Array.isArray(parsedData) && parsedData.length === 0) {
				console.error(
					`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty. TaskId: ${taskId}, Path: ${oldPath}`,
				)
			}
			await fs.unlink(oldPath)
			return parsedData
		}
	}

	// If we reach here, neither the new nor the old history file was found.
	console.error(
		`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await fs.writeFile(filePath, JSON.stringify(messages))
}
