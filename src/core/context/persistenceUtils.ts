import * as vscode from "vscode";
import * as path from "path";
import { GlobalFileNames } from "../../shared/globalFileNames";
import { ContextProxy } from "../config/ContextProxy";
import { logger } from "../../utils/logging";
import { getTaskDirectoryPath } from "../../shared/storagePathManager"; // Import the correct utility
import { PersistedContextHistory } from "./context-management/types";

// Helper function to get the full path to the context history file for a given task
async function getContextHistoryFilePath(contextProxy: ContextProxy, taskId: string): Promise<string | undefined> {
    if (!contextProxy.isInitialized) {
        logger.warn("ContextProxy not initialized when trying to get context history file path.");
        return undefined;
    }
    const globalStoragePath = contextProxy.globalStorageUri.fsPath;
    if (!globalStoragePath) {
    	logger.error("Global storage path is invalid when trying to get context history file path.");
    	return undefined;
    }
    const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(taskDir)); // Ensure directory exists
    return path.join(taskDir, GlobalFileNames.contextHistory); // Use defined filename constant
   }

/**
 * Reads the persisted context history from the task's storage.
 * @param contextProxy - The ContextProxy instance.
 * @param taskId - The ID of the task.
 * @returns The persisted context history, or an empty object if not found or error occurs.
 */
export async function readPersistedContextHistory(contextProxy: ContextProxy, taskId: string): Promise<PersistedContextHistory> {
    const filePath = await getContextHistoryFilePath(contextProxy, taskId);
    if (!filePath) {
        return {};
    }

    try {
        const fileUri = vscode.Uri.file(filePath);
        const fileExists = await vscode.workspace.fs.stat(fileUri).then(() => true, () => false);
        if (fileExists) {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const data = new TextDecoder().decode(fileContent);
            // TODO: Add validation (e.g., using Zod) to ensure data matches PersistedContextHistory schema
            return JSON.parse(data) as PersistedContextHistory;
        }
    } catch (error) {
        logger.error(`Failed to read context history for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {}; // Return empty object if file doesn't exist or on error
}

/**
 * Writes the context history modifications to the task's storage.
 * @param contextProxy - The ContextProxy instance.
 * @param taskId - The ID of the task.
 * @param history - The context history modifications to save.
 */
export async function writePersistedContextHistory(contextProxy: ContextProxy, taskId: string, history: PersistedContextHistory): Promise<void> {
    const filePath = await getContextHistoryFilePath(contextProxy, taskId);
    if (!filePath) {
        logger.error(`Could not determine file path to save context history for task ${taskId}.`);
        return;
    }

    try {
        const fileUri = vscode.Uri.file(filePath);
        const data = new TextEncoder().encode(JSON.stringify(history, null, 2)); // Pretty print JSON
        await vscode.workspace.fs.writeFile(fileUri, data);
    } catch (error) {
        logger.error(`Failed to write context history for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Types are defined in src/core/context/context-management/types.ts