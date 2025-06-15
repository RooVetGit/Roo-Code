import * as vscode from "vscode"
import * as path from "path"
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

// Usage:
// const oldDiagnostics = // ... your old diagnostics array
// const newDiagnostics = // ... your new diagnostics array
// const newProblems = getNewDiagnostics(oldDiagnostics, newDiagnostics);

// Example usage with mocks:
//
// // Mock old diagnostics
// const oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
//     [vscode.Uri.file("/path/to/file1.ts"), [
//         new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "Old error in file1", vscode.DiagnosticSeverity.Error)
//     ]],
//     [vscode.Uri.file("/path/to/file2.ts"), [
//         new vscode.Diagnostic(new vscode.Range(5, 5, 5, 15), "Old warning in file2", vscode.DiagnosticSeverity.Warning)
//     ]]
// ];
//
// // Mock new diagnostics
// const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
//     [vscode.Uri.file("/path/to/file1.ts"), [
//         new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "Old error in file1", vscode.DiagnosticSeverity.Error),
//         new vscode.Diagnostic(new vscode.Range(2, 2, 2, 12), "New error in file1", vscode.DiagnosticSeverity.Error)
//     ]],
//     [vscode.Uri.file("/path/to/file2.ts"), [
//         new vscode.Diagnostic(new vscode.Range(5, 5, 5, 15), "Old warning in file2", vscode.DiagnosticSeverity.Warning)
//     ]],
//     [vscode.Uri.file("/path/to/file3.ts"), [
//         new vscode.Diagnostic(new vscode.Range(1, 1, 1, 11), "New error in file3", vscode.DiagnosticSeverity.Error)
//     ]]
// ];
//
// const newProblems = getNewProblems(oldDiagnostics, newDiagnostics);
//
// console.log("New problems:");
// for (const [uri, diagnostics] of newProblems) {
//     console.log(`File: ${uri.fsPath}`);
//     for (const diagnostic of diagnostics) {
//         console.log(`- ${diagnostic.message} (${diagnostic.range.start.line}:${diagnostic.range.start.character})`);
//     }
// }
//
// // Expected output:
// // New problems:
// // File: /path/to/file1.ts
// // - New error in file1 (2:2)
// // File: /path/to/file3.ts
// // - New error in file3 (1:1)

// will return empty string if no problems with the given severity are found
export async function diagnosticsToProblemsString(
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
	cwd: string,
	options?: {
		includeDiagnostics?: boolean
		maxDiagnosticsCount?: number
		diagnosticsFilter?: string[]
	},
): Promise<string> {
	// Use provided options or fall back to VSCode configuration
	const includeDiagnostics =
		options?.includeDiagnostics ??
		vscode.workspace.getConfiguration("roo-cline").get<boolean>("includeDiagnostics", false)

	if (!includeDiagnostics) {
		return ""
	}

	const maxDiagnosticsCount =
		options?.maxDiagnosticsCount ??
		vscode.workspace.getConfiguration("roo-cline").get<number>("maxDiagnosticsCount", 5)
	const diagnosticsFilter =
		options?.diagnosticsFilter ??
		vscode.workspace.getConfiguration("roo-cline").get<string[]>("diagnosticsFilter", ["error", "warning"])

	const documents = new Map<vscode.Uri, vscode.TextDocument>()
	const fileStats = new Map<vscode.Uri, vscode.FileStat>()
	let result = ""
	let totalDiagnosticsCount = 0

	for (const [uri, fileDiagnostics] of diagnostics) {
		const problems = fileDiagnostics
			.filter((d) => severities.includes(d.severity))
			.filter((d) => {
				// Apply diagnostics filter
				if (diagnosticsFilter.length === 0) return true

				const source = d.source || ""
				const code = typeof d.code === "object" ? d.code.value : d.code
				const filterKey = source ? `${source} ${code || ""}`.trim() : `${code || ""}`.trim()

				// Check if this diagnostic should be filtered out
				return !diagnosticsFilter.some((filter) => {
					// Support partial matching
					return filterKey.includes(filter) || d.message.includes(filter)
				})
			})
			.sort((a, b) => a.range.start.line - b.range.start.line)

		if (problems.length > 0) {
			result += `\n\n${path.relative(cwd, uri.fsPath).toPosix()}`

			for (const diagnostic of problems) {
				// Check if we've reached the max count
				if (maxDiagnosticsCount > 0 && totalDiagnosticsCount >= maxDiagnosticsCount) {
					result += `\n... (${diagnostics.reduce((sum, [, diags]) => sum + diags.filter((d) => severities.includes(d.severity)).length, 0) - totalDiagnosticsCount} more diagnostics omitted)`
					return result.trim()
				}

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
				try {
					let fileStat = fileStats.get(uri)
					if (!fileStat) {
						fileStat = await vscode.workspace.fs.stat(uri)
						fileStats.set(uri, fileStat)
					}
					if (fileStat.type === vscode.FileType.File) {
						const document = documents.get(uri) || (await vscode.workspace.openTextDocument(uri))
						documents.set(uri, document)
						const lineContent = document.lineAt(diagnostic.range.start.line).text
						result += `\n- [${source}${label}] ${line} | ${lineContent} : ${diagnostic.message}`
					} else {
						result += `\n- [${source}${label}] 1 | (directory) : ${diagnostic.message}`
					}
				} catch {
					result += `\n- [${source}${label}] ${line} | (unavailable) : ${diagnostic.message}`
				}

				totalDiagnosticsCount++
			}
		}
	}
	return result.trim()
}
