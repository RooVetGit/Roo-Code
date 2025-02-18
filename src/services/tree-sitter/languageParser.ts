import * as path from "path"

import { Parser, Language, Query } from "web-tree-sitter"

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
		query: Query
	}
}

async function loadLanguage(langName: string) {
	if (process.env.NODE_ENV === "test") {
		const wasmPath = path.join(process.cwd(), "node_modules", "tree-sitter-wasms", "out")
		return await Language.load(path.join(wasmPath, `tree-sitter-${langName}.wasm`))
	}

	return await Language.load(path.join(__dirname, `tree-sitter-${langName}.wasm`))
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
export async function loadRequiredLanguageParsers(filesToParse: string[]): Promise<LanguageParser> {
	await initializeParser()
	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: LanguageParser = {}

	for (const ext of extensionsToLoad) {
		let language: Language
		let query: Query

		switch (ext) {
			case "js":
			case "jsx":
				language = await loadLanguage("javascript")
				query = new Query(language, javascriptQuery)
				break
			case "ts":
				language = await loadLanguage("typescript")
				query = new Query(language, typescriptQuery)
				break
			case "tsx":
				language = await loadLanguage("tsx")
				query = new Query(language, typescriptQuery)
				break
			case "py":
				language = await loadLanguage("python")
				query = new Query(language, pythonQuery)
				break
			case "rs":
				language = await loadLanguage("rust")
				query = new Query(language, rustQuery)
				break
			case "go":
				language = await loadLanguage("go")
				query = new Query(language, goQuery)
				break
			case "cpp":
			case "hpp":
				language = await loadLanguage("cpp")
				query = new Query(language, cppQuery)
				break
			case "c":
			case "h":
				language = await loadLanguage("c")
				query = new Query(language, cQuery)
				break
			case "cs":
				language = await loadLanguage("c_sharp")
				query = new Query(language, csharpQuery)
				break
			case "rb":
				language = await loadLanguage("ruby")
				query = new Query(language, rubyQuery)
				break
			case "java":
				language = await loadLanguage("java")
				query = new Query(language, javaQuery)
				break
			case "php":
				language = await loadLanguage("php")
				query = new Query(language, phpQuery)
				break
			case "swift":
				language = await loadLanguage("swift")
				query = new Query(language, swiftQuery)
				break
			default:
				throw new Error(`Unsupported language: ${ext}`)
		}

		const parser = new Parser()
		parser.setLanguage(language)
		parsers[ext] = { parser, query }
	}

	return parsers
}
