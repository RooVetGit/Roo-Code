import * as path from "path"

import * as vscode from "vscode"
import deepEqual from "fast-deep-equal"

export function getNewDiagnostics(
	oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
): [vscode.Uri, vscode.Diagnostic[]][] {
	const newProblems: [vscode.Uri, vscode.Diagnostic[]][] = []
	const oldMap = new Map(oldDiagnostics)

	for (const [uri, newDiags] of newDiagnostics) {
		const oldDiags = oldMap.get(uri) || []
		const newProblemsForUri = newDiags.filter((newDiag) => !oldDiags.some((oldDiag) => deepEqual(oldDiag, newDiag)))

		if (newProblemsForUri.length > 0) {
			newProblems.push([uri, newProblemsForUri])
		}
	}

	return newProblems
}

// Expected output:
// New problems:
// File: /path/to/file1.ts
// - New error in file1 (2:2)
// File: /path/to/file3.ts
// - New error in file3 (1:1)

// Will return empty string if no problems with the given severity are found.
export async function diagnosticsToProblemsString(
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
	cwd: string,
): Promise<string> {
	const documents = new Map<vscode.Uri, vscode.TextDocument>()
	let result = ""

	for (const [uri, fileDiagnostics] of diagnostics) {
		const problems = fileDiagnostics.filter((d) => severities.includes(d.severity))

		if (problems.length > 0) {
			result += `\n\n${path.relative(cwd, uri.fsPath).toPosix()}`

			for (const diagnostic of problems) {
				let label: string

				switch (diagnostic.severity) {
					case vscode.DiagnosticSeverity.Error:
						label = "Error"
						break
					case vscode.DiagnosticSeverity.Warning:
						label = "Warning"
						break
					case vscode.DiagnosticSeverity.Information:
						label = "Information"
						break
					case vscode.DiagnosticSeverity.Hint:
						label = "Hint"
						break
					default:
						label = "Diagnostic"
				}

				const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
				const source = diagnostic.source ? `${diagnostic.source} ` : ""
				const document = documents.get(uri) || (await vscode.workspace.openTextDocument(uri))
				documents.set(uri, document)
				const lineContent = document.lineAt(diagnostic.range.start.line).text
				result += `\n- [${source}${label}] ${line} | ${lineContent} : ${diagnostic.message}`
			}
		}
	}

	return result.trim()
}
