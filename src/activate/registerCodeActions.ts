import * as vscode from "vscode"

import { ACTION_NAMES, COMMAND_IDS } from "../core/CodeActionProvider"
import { EditorUtils } from "../core/EditorUtils"
import { ClineProvider } from "../core/webview/ClineProvider"

/**
 * Registers code actions for the CodeActionProvider.
 *
 * @param context - The extension context.
 */
export const registerCodeActions = (context: vscode.ExtensionContext) => {
	registerCodeActionPair(
		context,
		COMMAND_IDS.EXPLAIN,
		"EXPLAIN",
		"What would you like Roo to explain?",
		"E.g. How does the error handling work?",
	)

	registerCodeActionPair(
		context,
		COMMAND_IDS.FIX,
		"FIX",
		"What would you like Roo to fix?",
		"E.g. Maintain backward compatibility",
	)

	registerCodeActionPair(
		context,
		COMMAND_IDS.IMPROVE,
		"IMPROVE",
		"What would you like Roo to improve?",
		"E.g. Focus on performance optimization",
	)

	registerCodeAction(context, COMMAND_IDS.ADD_TO_CONTEXT, "ADD_TO_CONTEXT")
}

/**
 * Registers a code action command.
 *
 * @param context - The extension context.
 * @param command - The command ID to register.
 * @param promptType - The type of prompt to show, if any.
 * @param inputPrompt - The prompt to show when asking for user input.
 * @param inputPlaceholder - The placeholder to show in the input box.
 */
const registerCodeAction = (
	context: vscode.ExtensionContext,
	command: string,
	promptType: keyof typeof ACTION_NAMES,
	inputPrompt?: string,
	inputPlaceholder?: string,
) => {
	let userInput: string | undefined

	context.subscriptions.push(
		vscode.commands.registerCommand(command, async (...args: any[]) => {
			if (inputPrompt) {
				userInput = await vscode.window.showInputBox({
					prompt: inputPrompt,
					placeHolder: inputPlaceholder,
				})
			}

			// Handle both code action and direct command cases.
			let filePath: string
			let selectedText: string
			let diagnostics: any[] | undefined

			if (args.length > 1) {
				// Called from code action.
				;[filePath, selectedText, diagnostics] = args
			} else {
				// Called directly from command palette.
				const context = EditorUtils.getEditorContext()
				if (!context) return
				;({ filePath, selectedText, diagnostics } = context)
			}

			const params = {
				...{ filePath, selectedText },
				...(diagnostics ? { diagnostics } : {}),
				...(userInput ? { userInput } : {}),
			}

			await ClineProvider.handleCodeAction(command, promptType, params)
		}),
	)
}

/**
 * Registers two code action commands.
 *
 * The first command is registered with the given {@link baseCommand} and
 * {@link promptType}. The second command is registered with
 * `baseCommand + "InCurrentTask"` and the same {@link promptType}.
 *
 * @param context - The extension context.
 * @param baseCommand - The base command to register.
 * @param promptType - The type of prompt to show, if any.
 * @param inputPrompt - The prompt to show when asking for user input.
 * @param inputPlaceholder - The placeholder to show in the input box.
 */

const registerCodeActionPair = (
	context: vscode.ExtensionContext,
	baseCommand: string,
	promptType: keyof typeof ACTION_NAMES,
	inputPrompt?: string,
	inputPlaceholder?: string,
) => {
	// Register new task version.
	registerCodeAction(context, baseCommand, promptType, inputPrompt, inputPlaceholder)

	// Register current task version.
	registerCodeAction(context, `${baseCommand}InCurrentTask`, promptType, inputPrompt, inputPlaceholder)
}
