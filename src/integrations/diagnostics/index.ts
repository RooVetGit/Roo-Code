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
	includeDiagnostics: boolean = true,
	maxDiagnostics?: number,
): Promise<string> {
	// If diagnostics are disabled, return empty string
	if (!includeDiagnostics) {
		return ""
	}

	const documents = new Map<vscode.Uri, vscode.TextDocument>()
	const fileStats = new Map<vscode.Uri, vscode.FileStat>()
	let result = ""
	let diagnosticCount = 0

	// If we have a limit, we need to collect all diagnostics first, sort by severity, then limit
	if (maxDiagnostics && maxDiagnostics > 0) {
		// Flatten all diagnostics with their URIs
		const allDiagnostics: { uri: vscode.Uri; diagnostic: vscode.Diagnostic }[] = []
		for (const [uri, fileDiagnostics] of diagnostics) {
			const filtered = fileDiagnostics.filter((d) => severities.includes(d.severity))
			for (const diagnostic of filtered) {
				allDiagnostics.push({ uri, diagnostic })
			}
		}

		// Sort by severity (errors first) and then by line number
		allDiagnostics.sort((a, b) => {
			const severityDiff = a.diagnostic.severity - b.diagnostic.severity
			if (severityDiff !== 0) return severityDiff
			return a.diagnostic.range.start.line - b.diagnostic.range.start.line
		})

		// Take only the first maxDiagnostics
		const limitedDiagnostics = allDiagnostics.slice(0, maxDiagnostics)

		// Group back by URI for processing
		const groupedDiagnostics = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>()
		for (const { uri, diagnostic } of limitedDiagnostics) {
			const key = uri.toString()
			if (!groupedDiagnostics.has(key)) {
				groupedDiagnostics.set(key, { uri, diagnostics: [] })
			}
			groupedDiagnostics.get(key)!.diagnostics.push(diagnostic)
		}

		// Process the limited diagnostics
		for (const { uri, diagnostics: fileDiagnostics } of groupedDiagnostics.values()) {
			const problems = fileDiagnostics.sort((a, b) => a.range.start.line - b.range.start.line)
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
				}
			}
		}

		// Add a note if we hit the limit
		if (allDiagnostics.length > maxDiagnostics) {
			result += `\n\n(Showing ${maxDiagnostics} of ${allDiagnostics.length} total diagnostics)`
		}
	} else {
		// No limit, process all diagnostics as before
		for (const [uri, fileDiagnostics] of diagnostics) {
			const problems = fileDiagnostics
				.filter((d) => severities.includes(d.severity))
				.sort((a, b) => a.range.start.line - b.range.start.line)
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
					diagnosticCount++
				}
			}
		}
	}

	return result.trim()
}
