import * as fs from "fs/promises"
import * as path from "path"
import { listFiles } from "../glob/list-files"
import { LanguageParser, loadRequiredLanguageParsers } from "./languageParser"
import { fileExistsAtPath } from "../../utils/fs"
import { parseMarkdown } from "./markdownParser"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"

// Private constant
const DEFAULT_MIN_COMPONENT_LINES_VALUE = 4

// Getter function for MIN_COMPONENT_LINES (for easier testing)
let currentMinComponentLines = DEFAULT_MIN_COMPONENT_LINES_VALUE

export interface SymbolDefinition {
  name: string;
  code: string;
  startLine: number;
  endLine: number;
  // Potentially add startColumn, endColumn, byteOffsets if needed later
}

/**
 * Get the current minimum number of lines for a component to be included
 */
export function getMinComponentLines(): number {
	return currentMinComponentLines;
}

/**
 * Set the minimum number of lines for a component (for testing)
 */
export function setMinComponentLines(value: number): void {
	currentMinComponentLines = value;
}

const extensions = [
	"tla",
	"js",
	"jsx",
	"ts",
	"vue",
	"tsx",
	"py",
	// Rust
	"rs",
	"go",
	// C
	"c",
	"h",
	// C++
	"cpp",
	"hpp",
	// C#
	"cs",
	// Ruby
	"rb",
	"java",
	"php",
	"swift",
	// Solidity
	"sol",
	// Kotlin
	"kt",
	"kts",
	// Elixir
	"ex",
	"exs",
	// Elisp
	"el",
	// HTML
	"html",
	"htm",
	// Markdown
	"md",
	"markdown",
	// JSON
	"json",
	// CSS
	"css",
	// SystemRDL
	"rdl",
	// OCaml
	"ml",
	"mli",
	// Lua
	"lua",
	// Scala
	"scala",
	// TOML
	"toml",
	// Zig
	"zig",
	// Elm
	"elm",
	// Embedded Template
	"ejs",
	"erb",
].map((e) => `.${e}`);

export { extensions };

// Function to get just the definition lines string (old behavior for listCodeDefinitionNamesTool)
export async function getFormattedCodeDefinitionsForFile(
	filePath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | undefined> {
	const definitions = await getSymbolDefinitionsForFile(filePath, rooIgnoreController);
	if (typeof definitions === "string") { // Error message or unsupported
		return definitions;
	}
	if (!definitions || definitions.length === 0) {
		return undefined;
	}

	let formattedOutput = "";
	for (const def of definitions) {
		// This reconstructs the previous string format.
		// Note: `def.code.split('\n')[0]` gets the first line of the code.
		// This might not be exactly what was there before if the original `lines[startLine]`
		// was different from the first line of `definitionNode.text`.
		// However, `definitionNode.text` is more accurate for the actual symbol code.
		const firstLineOfCode = def.code.split('\n')[0];
		formattedOutput += `${def.startLine + 1}--${def.endLine + 1} | ${firstLineOfCode}\n`;
	}
	return `# ${path.basename(filePath)}\n${formattedOutput.trim()}`;
}


// New function to extract a single symbol's code
export async function extractSymbolCode(
	filePath: string,
	symbolName: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | null> {
	const definitions = await getSymbolDefinitionsForFile(filePath, rooIgnoreController);
	if (typeof definitions === "string" || !definitions) {
		// This means an error occurred (string) or no definitions found (null/undefined)
		return null;
	}

	const foundSymbol = definitions.find(def => def.name === symbolName);
	if (foundSymbol) {
		return foundSymbol.code;
	}
	return null; // Symbol not found
}


// Renamed and modified from parseSourceCodeDefinitionsForFile
// Now returns structured data or an error string
export async function getSymbolDefinitionsForFile(
	filePath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<SymbolDefinition[] | string | undefined> {
	// check if the file exists
	const fileExists = await fileExistsAtPath(path.resolve(filePath));
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it.";
	}

	// Get file extension to determine parser
	const ext = path.extname(filePath).toLowerCase();
	// Check if the file extension is supported
	if (!extensions.includes(ext)) {
		return undefined; // Unsupported file type
	}

	// Special case for markdown files - currently returns string, might need adjustment
	// For now, markdown will not return SymbolDefinition[]
	if (ext === ".md" || ext === ".markdown") {
		if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
			return undefined;
		}
		const fileContent = await fs.readFile(filePath, "utf8");
		const lines = fileContent.split("\n");
		const markdownCaptures = parseMarkdown(fileContent);
		// processCaptures needs to be adapted if we want structured data for markdown
		const markdownDefinitionsString = processCapturesToFormattedString(markdownCaptures, lines, "markdown");
		if (markdownDefinitionsString) {
			// This path currently doesn't return SymbolDefinition[]
			// For simplicity, tools requesting specific symbols from Markdown might not be supported yet
			// or would need further refinement of processCaptures / markdownParser
			return `# ${path.basename(filePath)}\n${markdownDefinitionsString}`;
		}
		return undefined;
	}

	// For other file types, load parser and use tree-sitter
	const languageParsers = await loadRequiredLanguageParsers([filePath]);

	// Parse the file if we have a parser for it
	// parseFile will now return SymbolDefinition[]
	return parseFile(filePath, languageParsers, rooIgnoreController);
}


// TODO: implement caching behavior to avoid having to keep analyzing project for new tasks.
export async function parseSourceCodeForDefinitionsTopLevel(
	dirPath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	// check if the path exists
	const dirExists = await fileExistsAtPath(path.resolve(dirPath));
	if (!dirExists) {
		return "This directory does not exist or you do not have permission to access it.";
	}

	// Get all files at top level (not gitignored)
	const [allFiles, _] = await listFiles(dirPath, false, 200);

	let result = "";

	// Separate files to parse and remaining files
	const { filesToParse } = separateFiles(allFiles);

	// Filter filepaths for access if controller is provided
	const allowedFilesToParse = rooIgnoreController ? rooIgnoreController.filterPaths(filesToParse) : filesToParse;

	// Separate markdown files from other files
	const markdownFiles: string[] = [];
	const otherFiles: string[] = [];

	for (const file of allowedFilesToParse) {
		const ext = path.extname(file).toLowerCase();
		if (ext === ".md" || ext === ".markdown") {
			markdownFiles.push(file);
		} else {
			otherFiles.push(file);
		}
	}

	// Load language parsers only for non-markdown files
	const languageParsers = await loadRequiredLanguageParsers(otherFiles);

	// Process markdown files (still using old string formatting)
	for (const file of markdownFiles) {
		if (rooIgnoreController && !rooIgnoreController.validateAccess(file)) {
			continue;
		}
		try {
			const fileContent = await fs.readFile(file, "utf8");
			const lines = fileContent.split("\n");
			const markdownCaptures = parseMarkdown(fileContent);
			const markdownDefinitions = processCapturesToFormattedString(markdownCaptures, lines, "markdown");
			if (markdownDefinitions) {
				result += `# ${path.relative(dirPath, file).toPosix()}\n${markdownDefinitions}\n`;
			}
		} catch (error) {
			console.log(`Error parsing markdown file: ${error}\n`);
		}
	}

	// Process other files using tree-sitter
	for (const file of otherFiles) {
		const definitionsArray = await parseFile(file, languageParsers, rooIgnoreController);
		if (definitionsArray && definitionsArray.length > 0) {
			result += `# ${path.relative(dirPath, file).toPosix()}\n`;
			definitionsArray.forEach(def => {
				const firstLineOfCode = def.code.split('\n')[0];
				result += `${def.startLine + 1}--${def.endLine + 1} | ${firstLineOfCode}\n`;
			});
			result += '\n';
		}
	}

	return result ? result.trim() : "No source code definitions found.";
}

function separateFiles(allFiles: string[]): { filesToParse: string[]; remainingFiles: string[] } {
	const filesToParse = allFiles.filter((file) => extensions.includes(path.extname(file))).slice(0, 50) // 50 files max
	const remainingFiles = allFiles.filter((file) => !filesToParse.includes(file))
	return { filesToParse, remainingFiles }
}

/*
Parsing files using tree-sitter

1. Parse the file content into an AST (Abstract Syntax Tree) using the appropriate language grammar (set of rules that define how the components of a language like keywords, expressions, and statements can be combined to create valid programs).
2. Create a query using a language-specific query string, and run it against the AST's root node to capture specific syntax elements.
    - We use tag queries to identify named entities in a program, and then use a syntax capture to label the entity and its name. A notable example of this is GitHub's search-based code navigation.
	- Our custom tag queries are based on tree-sitter's default tag queries, but modified to only capture definitions.
3. Sort the captures by their position in the file, output the name of the definition, and format by i.e. adding "|----\n" for gaps between captured sections.

This approach allows us to focus on the most relevant parts of the code (defined by our language-specific queries) and provides a concise yet informative view of the file's structure and key elements.

- https://github.com/tree-sitter/node-tree-sitter/blob/master/test/query_test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/helper.js
- https://tree-sitter.github.io/tree-sitter/code-navigation-systems
*/
/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param rooIgnoreController - Optional controller to check file access permissions
 * @returns A formatted string with code definitions or null if no definitions found
 */

/**
 * Process captures from tree-sitter or markdown parser
 *
 * @param captures - The captures to process
 * @param lines - The lines of the file (can be undefined if not needed by underlying logic)
 * @param minComponentLines - Minimum number of lines for a component to be included
 * @returns An array of SymbolDefinition objects or null.
 */
function processCapturesToSymbolDefinitions(captures: any[], language: string): SymbolDefinition[] | null {
	// Determine if HTML filtering is needed for this language
	const needsHtmlFiltering = ["jsx", "tsx"].includes(language);

	// Filter function to exclude HTML elements if needed
	const isNotHtmlElement = (line: string): boolean => {
		if (!needsHtmlFiltering) return true;
		const HTML_ELEMENTS = /^[^A-Z]*<\/?(?:div|span|button|input|h[1-6]|p|a|img|ul|li|form)\b/;
		const trimmedLine = line.trim();
		return !HTML_ELEMENTS.test(trimmedLine);
	};

	if (captures.length === 0) {
		return null;
	}

	const definitions: SymbolDefinition[] = [];
	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row);
	const processedLineRanges = new Set<string>();

	captures.forEach((capture) => {
		const { node, name: captureName } = capture;

		if (!captureName.includes("definition") && !captureName.includes("name")) {
			return;
		}

		const definitionNode = captureName.includes("name") ? node.parent : node;
		if (!definitionNode) return;

		const startLine = definitionNode.startPosition.row;
		const endLine = definitionNode.endPosition.row;
		const lineCount = endLine - startLine + 1;

		if (lineCount < getMinComponentLines()) {
			return;
		}

		const lineKey = `${startLine}-${endLine}`;
		if (processedLineRanges.has(lineKey)) {
			return;
		}

		// Use definitionNode.text for the full code of the symbol
		const code = definitionNode.text;
		// The first line of the actual code block might be more relevant for `isNotHtmlElement`
		const firstCodeLine = code.split('\n')[0]?.trim() || "";


		let symbolName = "Unknown";
		if (captureName.includes("name.definition")) {
			symbolName = node.text; // This is the name of the symbol
		} else {
			// Try to infer symbol name from the first line of its code
			// This is a simple inference, might need language-specific logic
			const match = firstCodeLine.match(/(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z0-9_]+)/);
			if (match && match[1]) {
				symbolName = match[1];
			} else if (definitionNode.type) { // Fallback to node type if no name found
				symbolName = definitionNode.type;
			}
		}

		if (captureName.includes("definition") && !isNotHtmlElement(firstCodeLine) ) {
			return;
		}

		definitions.push({
			name: symbolName,
			code: code,
			startLine: startLine,
			endLine: endLine,
		});
		processedLineRanges.add(lineKey);
	});

	return definitions.length > 0 ? definitions : null;
}

// This is the original processCaptures, renamed to keep compatibility where string output is needed.
function processCapturesToFormattedString(captures: any[], lines: string[], language: string): string | null {
	const needsHtmlFiltering = ["jsx", "tsx"].includes(language);
	const isNotHtmlElement = (line: string): boolean => {
		if (!needsHtmlFiltering) return true;
		const HTML_ELEMENTS = /^[^A-Z]*<\/?(?:div|span|button|input|h[1-6]|p|a|img|ul|li|form)\b/;
		const trimmedLine = line.trim();
		return !HTML_ELEMENTS.test(trimmedLine);
	};

	if (captures.length === 0) return null;

	let formattedOutput = "";
	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row);
	const processedLines = new Set<string>();

	captures.forEach((capture) => {
		const { node, name } = capture;
		if (!name.includes("definition") && !name.includes("name")) return;

		const definitionNode = name.includes("name") ? node.parent : node;
		if (!definitionNode) return;

		const startLine = definitionNode.startPosition.row;
		const endLine = definitionNode.endPosition.row;
		const lineCount = endLine - startLine + 1;

		if (lineCount < getMinComponentLines()) return;

		const lineKey = `${startLine}-${endLine}`;
		if (processedLines.has(lineKey)) return;

		const startLineContent = lines[startLine]?.trim() || ""; // Use optional chaining and default

		if (name.includes("name.definition")) {
			const componentName = node.text;
			if (componentName) { // Ensure componentName is not empty
				formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`;
				processedLines.add(lineKey);
			}
		} else if (isNotHtmlElement(startLineContent)) {
			formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`;
			processedLines.add(lineKey);

			if (node.parent && node.parent.lastChild) {
				const contextEnd = node.parent.lastChild.endPosition.row;
				const contextSpan = contextEnd - node.parent.startPosition.row + 1;
				if (contextSpan >= getMinComponentLines()) {
					const rangeKey = `${node.parent.startPosition.row}-${contextEnd}`;
					if (!processedLines.has(rangeKey)) {
						formattedOutput += `${node.parent.startPosition.row + 1}--${contextEnd + 1} | ${lines[node.parent.startPosition.row]}\n`;
						processedLines.add(rangeKey);
					}
				}
			}
		}
	});
	return formattedOutput.length > 0 ? formattedOutput.trim() : null;
}


/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param rooIgnoreController - Optional controller to check file access permissions
 * @returns An array of SymbolDefinition objects or null if no definitions found or error.
 */
async function parseFile(
	filePath: string,
	languageParsers: LanguageParser,
	rooIgnoreController?: RooIgnoreController,
): Promise<SymbolDefinition[] | null> {
	if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
		return null;
	}

	const fileContent = await fs.readFile(filePath, "utf8");
	const extLang = path.extname(filePath).toLowerCase().slice(1);

	const { parser, query } = languageParsers[extLang] || {};
	if (!parser || !query) {
		// console.log(`Unsupported file type or no parser/query for: ${filePath}`);
		return null; // Return null for unsupported file types
	}

	try {
		const tree = parser.parse(fileContent);
		const captures = query.captures(tree.rootNode);
		// No longer pass 'lines' to this function, it uses node.text
		return processCapturesToSymbolDefinitions(captures, extLang);
	} catch (error) {
		console.log(`Error parsing file ${filePath}: ${error}\n`);
		return null;
	}
}
