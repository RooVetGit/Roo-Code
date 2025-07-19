import { safeReadJson } from "../../utils/safeReadJson"
import { safeWriteJson } from "../../utils/safeWriteJson"
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

	try {
		const parsedData = await safeReadJson(filePath)
		if (Array.isArray(parsedData) && parsedData.length === 0) {
			console.error(
				`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
			)
		}
		return parsedData
	} catch (error: any) {
		if (error.code === "ENOENT") {
			// File doesn't exist, try the old path
			const oldPath = path.join(taskDir, "claude_messages.json")

			try {
				const parsedData = await safeReadJson(oldPath)
				if (Array.isArray(parsedData) && parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return parsedData
			} catch (oldError: any) {
				if (oldError.code === "ENOENT") {
					// If we reach here, neither the new nor the old history file was found.
					console.error(
						`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
					)
					return []
				}

				// For any other error with the old file, log and rethrow
				console.error(
					`[Roo-Debug] readApiMessages: Error reading OLD API conversation history file (claude_messages.json). TaskId: ${taskId}, Path: ${oldPath}, Error: ${oldError}`,
				)
				throw oldError
			}
		} else {
			// For any other error with the main file, log and rethrow
			console.error(
				`[Roo-Debug] readApiMessages: Error reading API conversation history file. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			throw error
		}
	}
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
	await safeWriteJson(filePath, messages)
}
