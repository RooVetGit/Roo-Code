import * as path from "path"
import Parser from "web-tree-sitter"
import {
	javascriptQuery,
	typescriptQuery,
	pythonQuery,
	rustQuery,
	goQuery,
	cppQuery,
	cQuery,
	csharpQuery,
	rubyQuery,
	javaQuery,
	phpQuery,
	swiftQuery,
} from "./queries"

export interface LanguageParser {
	[key: string]: {
		parser: Parser
		query: Parser.Query
	}
}

async function loadLanguage(langName: string, wasmDir: string) {
	return Parser.Language.load(path.join(wasmDir, `tree-sitter-${langName}.wasm`))
}

let isParserInitialized = false

async function initializeParser() {
	if (!isParserInitialized) {
		await Parser.init()
		isParserInitialized = true
	}
}

/*
Using node bindings for tree-sitter is problematic in vscode extensions 
because of incompatibility with electron. Going the .wasm route has the 
advantage of not having to build for multiple architectures.

We use web-tree-sitter and tree-sitter-wasms which provides auto-updating prebuilt WASM binaries for tree-sitter's language parsers.

This function loads WASM modules for relevant language parsers based on input files:
1. Extracts unique file extensions
2. Maps extensions to language names
3. Loads corresponding WASM files (containing grammar rules)
4. Uses WASM modules to initialize tree-sitter parsers

This approach optimizes performance by loading only necessary parsers once for all relevant files.

Sources:
- https://github.com/tree-sitter/node-tree-sitter/issues/169
- https://github.com/tree-sitter/node-tree-sitter/issues/168
- https://github.com/Gregoor/tree-sitter-wasms/blob/main/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
*/
export async function loadRequiredLanguageParsers(
	filePaths: string[],
	queries?: Record<string, string>,
	wasmDir?: string,
): Promise<Record<string, { parser: Parser; query: Parser.Query }>> {
	await initializeParser()
	const extensionsToLoad = new Set(filePaths.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: Record<string, { parser: Parser; query: Parser.Query }> = {}

	// Default queries if not provided
	const defaultQueries = {
		js: javascriptQuery,
		jsx: javascriptQuery,
		ts: typescriptQuery,
		tsx: typescriptQuery,
		py: pythonQuery,
		rs: rustQuery,
		go: goQuery,
		cpp: cppQuery,
		hpp: cppQuery,
		c: cQuery,
		h: cQuery,
		cs: csharpQuery,
		rb: rubyQuery,
		java: javaQuery,
		php: phpQuery,
		swift: swiftQuery,
	}

	// Use wasmDir if provided, otherwise use default
	const basePath = wasmDir || __dirname

	// Update WASM loading paths to use the provided directory
	await Parser.init({
		locateFile(scriptName: string) {
			return path.join(basePath, scriptName)
		},
	})

	for (const ext of extensionsToLoad) {
		let language: Parser.Language
		let query: Parser.Query
		switch (ext) {
			case "js":
			case "jsx":
				language = await loadLanguage("javascript", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "ts":
				language = await loadLanguage("typescript", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "tsx":
				language = await loadLanguage("tsx", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "py":
				language = await loadLanguage("python", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "rs":
				language = await loadLanguage("rust", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "go":
				language = await loadLanguage("go", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "cpp":
			case "hpp":
				language = await loadLanguage("cpp", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "c":
			case "h":
				language = await loadLanguage("c", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "cs":
				language = await loadLanguage("c_sharp", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "rb":
				language = await loadLanguage("ruby", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "java":
				language = await loadLanguage("java", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "php":
				language = await loadLanguage("php", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			case "swift":
				language = await loadLanguage("swift", basePath)
				query = language.query(queries?.[ext] || defaultQueries[ext])
				break
			default:
				console.log(`Unsupported language: ${ext}`)
				continue
		}
		const parser = new Parser()
		parser.setLanguage(language)
		parsers[ext] = { parser, query }
	}
	return parsers
}
