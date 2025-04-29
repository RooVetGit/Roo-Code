import * as vscode from "vscode"

import { EditorUtils } from "./EditorUtils"

export type CodeActionName = "EXPLAIN" | "FIX" | "ADD_TO_CONTEXT" | "NEW_TASK"

export type CodeActionId =
	| "roo-cline.explainCode"
	| "roo-cline.fixCode"
	| "roo-cline.addToContext"
	| "roo-cline.newTask"

export const ACTION_NAMES: Record<CodeActionName, string> = {
	EXPLAIN: "Explain with Roo Code",
	FIX: "Fix with Roo Code",
	ADD_TO_CONTEXT: "Add to Roo Code",
	NEW_TASK: "New Roo Code Task",
} as const

export const COMMAND_IDS: Record<CodeActionName, CodeActionId> = {
	EXPLAIN: "roo-cline.explainCode",
	FIX: "roo-cline.fixCode",
	ADD_TO_CONTEXT: "roo-cline.addToContext",
	NEW_TASK: "roo-cline.newTask",
} as const

export class CodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.RefactorRewrite,
	]

	private createAction(title: string, kind: vscode.CodeActionKind, command: string, args: any[]): vscode.CodeAction {
		const action = new vscode.CodeAction(title, kind)
		action.command = { command, title, arguments: args }
		return action
	}

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
	): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		try {
			const effectiveRange = EditorUtils.getEffectiveRange(document, range)

			if (!effectiveRange) {
				return []
			}

			const filePath = EditorUtils.getFilePath(document)
			const actions: vscode.CodeAction[] = []

			actions.push(
				this.createAction(
					ACTION_NAMES.ADD_TO_CONTEXT,
					vscode.CodeActionKind.QuickFix,
					COMMAND_IDS.ADD_TO_CONTEXT,
					[
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					],
				),
			)

			actions.push(
				this.createAction(ACTION_NAMES.EXPLAIN, vscode.CodeActionKind.QuickFix, COMMAND_IDS.EXPLAIN, [
					filePath,
					effectiveRange.text,
					effectiveRange.range.start.line + 1,
					effectiveRange.range.end.line + 1,
				]),
			)

			if (context.diagnostics.length > 0) {
				const relevantDiagnostics = context.diagnostics.filter((d) =>
					EditorUtils.hasIntersectingRange(effectiveRange.range, d.range),
				)

				if (relevantDiagnostics.length > 0) {
					actions.push(
						this.createAction(ACTION_NAMES.FIX, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
							filePath,
							effectiveRange.text,
							effectiveRange.range.start.line + 1,
							effectiveRange.range.end.line + 1,
							relevantDiagnostics.map(EditorUtils.createDiagnosticData),
						]),
					)
				}
			}

			return actions
		} catch (error) {
			console.error("Error providing code actions:", error)
			return []
		}
	}
}
