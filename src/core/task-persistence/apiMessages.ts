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

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		try {
			const parsedData = JSON.parse(fileContent)
			if (Array.isArray(parsedData) && parsedData.length === 0) {
				console.error(
					`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}
			return parsedData
		} catch (error) {
			console.error(
				`[Roo-Debug] readApiMessages: Error parsing API conversation history file. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			throw error
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (Array.isArray(parsedData) && parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return parsedData
			} catch (error) {
				console.error(
					`[Roo-Debug] readApiMessages: Error parsing OLD API conversation history file (claude_messages.json). TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				// DO NOT unlink oldPath if parsing failed, throw error instead.
				throw error
			}
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
	// Validate messages before saving to prevent data corruption
	if (!Array.isArray(messages)) {
		console.error(
			`[Roo-Debug] saveApiMessages: Invalid messages format - expected array, got ${typeof messages}. TaskId: ${taskId}`,
		)
		throw new Error("Invalid messages format for saving")
	}

	// Log warning for unusually large conversations
	if (messages.length > 1000) {
		console.warn(
			`[Roo-Debug] saveApiMessages: Saving large conversation with ${messages.length} messages. TaskId: ${taskId}`,
		)
	}

	// Validate message structure
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (!msg || typeof msg !== "object") {
			console.error(
				`[Roo-Debug] saveApiMessages: Invalid message at index ${i} - expected object, got ${typeof msg}. TaskId: ${taskId}`,
			)
			throw new Error(`Invalid message structure at index ${i}`)
		}
		if (!msg.role || (msg.role !== "user" && msg.role !== "assistant")) {
			console.error(
				`[Roo-Debug] saveApiMessages: Invalid message role at index ${i} - got "${msg.role}". TaskId: ${taskId}`,
			)
			throw new Error(`Invalid message role at index ${i}`)
		}
	}

	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	// Log the save operation for debugging
	console.log(`[Roo-Debug] saveApiMessages: Saving ${messages.length} messages to ${filePath}. TaskId: ${taskId}`)

	await safeWriteJson(filePath, messages)
}
