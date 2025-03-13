import * as path from "path"
import * as vscode from "vscode"

/**
 * Gets documentation for a symbol by name, optionally scoped to a specific file.
 * Uses VS Code's language services to find symbol definitions and hover information.
 *
 * @param symbolName The name of the symbol to look up
 * @param filePath Optional path to a file where the symbol might be defined or referenced
 * @param cwd Current working directory for resolving relative paths
 * @returns Formatted documentation string with symbol details
 */
export async function getSymbolDocumentation(
	symbolName: string,
	filePath?: string,
	cwd: string = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
): Promise<string> {
	try {
		// STEP 1: If file path is provided, try to find the symbol in that file first
		if (filePath) {
			const uri = vscode.Uri.file(path.resolve(cwd, filePath))

			try {
				// Try to open the document
				const document = await vscode.workspace.openTextDocument(uri)

				// STEP 1a: Check if symbol is defined in the document
				const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					"vscode.executeDocumentSymbolProvider",
					uri,
				)

				// Helper function to search recursively through DocumentSymbol hierarchy
				const findSymbolInHierarchy = (
					symbols?: vscode.DocumentSymbol[],
				): vscode.DocumentSymbol | undefined => {
					if (!symbols) return undefined

					for (const symbol of symbols) {
						if (symbol.name === symbolName) {
							return symbol
						}

						const found = findSymbolInHierarchy(symbol.children)
						if (found) return found
					}

					return undefined
				}

				// Look for the symbol in document symbols
				const foundSymbol = findSymbolInHierarchy(documentSymbols)

				if (foundSymbol) {
					// Found the symbol definition in document
					const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
						"vscode.executeHoverProvider",
						uri,
						foundSymbol.selectionRange.start,
					)

					let hoverText = ""
					if (hoverResults && hoverResults.length > 0) {
						// Extract the text from hover results
						for (const content of hoverResults[0].contents) {
							if (typeof content === "string") {
								hoverText += content + "\n"
							} else {
								// MarkdownString
								hoverText += content.value + "\n"
							}
						}
					}

					return `Symbol: ${symbolName}
Location: ${uri.fsPath}:${foundSymbol.selectionRange.start.line + 1}:${foundSymbol.selectionRange.start.character + 1}
Kind: ${vscode.SymbolKind[foundSymbol.kind]}
Status: Defined in file

Documentation:
${hoverText || "No documentation available for this symbol."}`
				}

				// STEP 1b: If not defined in document, search for references to the symbol
				// Find all occurrences of the symbol in text
				const text = document.getText()
				const occurrences: vscode.Position[] = []
				const regex = new RegExp(`\\b${symbolName}\\b`, "g")

				let match
				while ((match = regex.exec(text)) !== null) {
					const pos = document.positionAt(match.index)
					occurrences.push(pos)
				}

				// Try each occurrence to see if we can get hover or definition info
				for (const position of occurrences) {
					// Try hover first
					const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
						"vscode.executeHoverProvider",
						uri,
						position,
					)

					if (hoverResults && hoverResults.length > 0) {
						// Extract the text from hover results
						let hoverText = ""
						for (const content of hoverResults[0].contents) {
							if (typeof content === "string") {
								hoverText += content + "\n"
							} else {
								// MarkdownString
								hoverText += content.value + "\n"
							}
						}

						if (hoverText.trim()) {
							// Try to get definition as well
							const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
								"vscode.executeDefinitionProvider",
								uri,
								position,
							)

							let defLocationStr = `${uri.fsPath}:${position.line + 1}:${position.character + 1}`
							let definedInFile = "Referenced in file"

							if (definitions && definitions.length > 0) {
								const def = definitions[0]
								defLocationStr = `${def.uri.fsPath}:${def.range.start.line + 1}:${def.range.start.character + 1}`
								definedInFile = "Imported/Referenced"
							}

							return `Symbol: ${symbolName}
Location: ${defLocationStr}
Status: ${definedInFile}
Referenced in: ${filePath}

Documentation:
${hoverText.trim()}`
						}
					}

					// If hover didn't work, try getting the definition directly
					const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
						"vscode.executeDefinitionProvider",
						uri,
						position,
					)

					if (definitions && definitions.length > 0) {
						const def = definitions[0]
						const defHoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
							"vscode.executeHoverProvider",
							def.uri,
							def.range.start,
						)

						if (defHoverResults && defHoverResults.length > 0) {
							// Extract the text from hover results
							let hoverText = ""
							for (const content of defHoverResults[0].contents) {
								if (typeof content === "string") {
									hoverText += content + "\n"
								} else {
									// MarkdownString
									hoverText += content.value + "\n"
								}
							}

							if (hoverText.trim()) {
								return `Symbol: ${symbolName}
Location: ${def.uri.fsPath}:${def.range.start.line + 1}:${def.range.start.character + 1}
Status: Imported/Referenced
Referenced in: ${filePath}

Documentation:
${hoverText.trim()}`
							}
						}

						// We found a definition but no hover info
						return `Symbol: ${symbolName}
Location: ${def.uri.fsPath}:${def.range.start.line + 1}:${def.range.start.character + 1}
Status: Imported/Referenced
Referenced in: ${filePath}

No documentation is available for this symbol.`
					}
				}

				// Couldn't find the symbol in the file
				return `No symbol '${symbolName}' found in file '${filePath}'.`
			} catch (error) {
				return `Error: Could not analyze file '${filePath}': ${error.message}`
			}
		}

		// STEP 2: If no file path or symbol not found in specified file, try workspace symbols
		const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			"vscode.executeWorkspaceSymbolProvider",
			symbolName,
		)

		if (workspaceSymbols && workspaceSymbols.length > 0) {
			// Found at least one matching symbol in workspace
			const symbol = workspaceSymbols[0]
			const uri = symbol.location.uri
			const position = symbol.location.range.start

			const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
				"vscode.executeHoverProvider",
				uri,
				position,
			)

			let hoverText = ""
			if (hoverResults && hoverResults.length > 0) {
				// Extract the text from hover results
				for (const content of hoverResults[0].contents) {
					if (typeof content === "string") {
						hoverText += content + "\n"
					} else {
						// MarkdownString
						hoverText += content.value + "\n"
					}
				}
			}

			return `Symbol: ${symbolName}
Location: ${uri.fsPath}:${position.line + 1}:${position.character + 1}
Kind: ${vscode.SymbolKind[symbol.kind]}
Container: ${symbol.containerName || "Global Scope"}
${filePath ? `Not directly referenced in: ${filePath}` : ""}

Documentation:
${hoverText.trim() || "No documentation available for this symbol."}`
		}

		// STEP 3: No results found
		return `No symbol found for '${symbolName}'${filePath ? ` in or referenced by file '${filePath}'` : ""}.`
	} catch (error) {
		return `Error retrieving documentation for symbol '${symbolName}': ${error.message}`
	}
}
