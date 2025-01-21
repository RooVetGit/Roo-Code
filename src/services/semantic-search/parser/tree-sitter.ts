import * as fs from "fs/promises"
import * as path from "path"
import { loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import type Parser from "web-tree-sitter"
import { CodeSegment, ParsedFile, SemanticParser, IMPORTANCE_WEIGHTS } from "./types"
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
} from "../../tree-sitter/queries"

export class TreeSitterParser implements SemanticParser {
	private languageParsers: Record<string, { parser: Parser; query: Parser.Query }> = {}
	private initialized = false

	private async initialize(filePath: string) {
		if (!this.initialized) {
			try {
				// Create dummy files for all supported languages to ensure parsers are loaded
				const dummyFiles = Object.entries(this.getLanguageMap()).map(([ext]) => `dummy.${ext}`)
				this.languageParsers = await loadRequiredLanguageParsers([filePath, ...dummyFiles])
				this.initialized = true
			} catch (error) {
				console.warn(`Failed to load parser for ${filePath}, will skip parsing: ${error}`)
				// Initialize with empty parsers rather than failing
				this.languageParsers = {}
				this.initialized = true
			}
		}
	}

	private getLanguageMap(): Record<string, string> {
		return {
			js: "javascript",
			jsx: "javascript",
			ts: "typescript",
			tsx: "typescript",
			py: "python",
			rs: "rust",
			go: "go",
			cpp: "cpp",
			hpp: "cpp",
			c: "c",
			h: "c",
			cs: "c_sharp",
			rb: "ruby",
			java: "java",
			php: "php",
			swift: "swift",
		}
	}

	private getLanguageFromExt(ext: string): string {
		return this.getLanguageMap()[ext] || ext
	}

	private getQueryForLanguage(language: string): string {
		switch (language) {
			case "javascript":
				return javascriptQuery
			case "typescript":
				return typescriptQuery
			case "python":
				return pythonQuery
			case "rust":
				return rustQuery
			case "go":
				return goQuery
			case "cpp":
				return cppQuery
			case "c":
				return cQuery
			case "c_sharp":
				return csharpQuery
			case "ruby":
				return rubyQuery
			case "java":
				return javaQuery
			case "php":
				return phpQuery
			case "swift":
				return swiftQuery
			default:
				throw new Error(`No query available for language: ${language}`)
		}
	}

	private async parseSegments(tree: Parser.Tree, fileContent: string, language: string): Promise<CodeSegment[]> {
		const segments: CodeSegment[] = []
		const lines = fileContent.split("\n")

		// Get all captures from the tree
		const ext = Object.entries(this.getLanguageMap()).find(([_, lang]) => lang === language)?.[0]
		if (!ext || !this.languageParsers[ext]) {
			console.log(`No parser found for language: ${language}`)
			return segments
		}

		const { parser, query } = this.languageParsers[ext]
		console.log(`Querying AST for language: ${language}`)

		const captures = query.captures(tree.rootNode)
		console.log(`Found ${captures.length} captures`)

		captures.forEach((capture) => {
			console.log(`Capture: ${capture.name} - ${capture.node.type} - ${capture.node.text}`)
		})

		// Sort captures by position
		captures.sort((a, b) => {
			if (a.node.startPosition.row === b.node.startPosition.row) {
				return a.node.startPosition.column - b.node.startPosition.column
			}
			return a.node.startPosition.row - b.node.startPosition.row
		})

		let currentContext: string | undefined

		for (const capture of captures) {
			const { node, name } = capture

			// Update context for nested definitions
			if (name.includes("class") || name.includes("module")) {
				currentContext = node.text
			}

			if (name.includes("name") && name.includes("definition")) {
				const type = name.split(".")[2] as CodeSegment["type"] // e.g., 'name.definition.function' -> 'function'
				const startLine = node.startPosition.row
				const endLine = node.endPosition.row

				// Get the full content
				const content = lines.slice(startLine, endLine + 1).join("\n")

				// Extract docstring if available
				const docstring = this.extractDocstring(node, lines)

				// Extract params and return type for functions/methods
				const { params, returnType } = this.extractFunctionSignature(node)

				segments.push({
					type,
					name: node.text,
					content,
					context: currentContext,
					startLine,
					endLine,
					importance: IMPORTANCE_WEIGHTS[type.toUpperCase() as keyof typeof IMPORTANCE_WEIGHTS] || 0.5,
					language,
					docstring,
					params,
					returnType,
				})
			}
		}

		return segments
	}

	private extractDocstring(node: Parser.SyntaxNode, lines: string[]): string | undefined {
		// Look for comment nodes before the current node
		let current = node.previousSibling
		while (current && current.type === "comment") {
			return current.text.replace(/^\/\*|\*\/$/g, "").trim() // Clean up comment markers
		}
		return undefined
	}

	private extractFunctionSignature(node: Parser.SyntaxNode): {
		params: Array<{ name: string; type?: string }>
		returnType?: string
	} {
		const params: Array<{ name: string; type?: string }> = []
		let returnType: string | undefined

		// Find parameter list and return type based on language-specific AST structure
		// This is a simplified version - would need to be expanded for each language
		const paramList = node.parent?.childForFieldName("parameters")
		if (paramList) {
			for (const param of paramList.children) {
				if (param.type === "parameter") {
					const paramName = param.childForFieldName("name")?.text
					const paramType = param.childForFieldName("type")?.text
					if (paramName) {
						params.push({ name: paramName, type: paramType })
					}
				}
			}
		}

		// Try to find return type annotation
		const returnTypeNode = node.parent?.childForFieldName("return_type")
		if (returnTypeNode) {
			returnType = returnTypeNode.text
		}

		return { params, returnType }
	}

	async parseFile(filePath: string): Promise<ParsedFile> {
		await this.initialize(filePath)

		const fileContent = await fs.readFile(filePath, "utf8")
		const ext = path.extname(filePath).toLowerCase().slice(1)
		const language = this.getLanguageFromExt(ext)

		console.log(`Parsing ${filePath} as ${language}`)

		// Skip parsing if language not supported
		if (!this.languageParsers[ext]) {
			console.log(`No parser available for language: ${language}`)
			return {
				path: filePath,
				segments: [],
				imports: [],
				exports: [],
				summary: `File type .${ext} not supported for parsing`,
			}
		}

		try {
			const { parser } = this.languageParsers[ext]
			console.log(`Parser loaded for ${language}`)

			const tree = parser.parse(fileContent)
			console.log(`AST generated, root node type: ${tree.rootNode.type}`)

			const segments = await this.parseSegments(tree, fileContent, language)
			console.log(`Found ${segments.length} segments`)

			// TODO: Implement import/export extraction based on language
			const imports: string[] = []
			const exports: string[] = []

			// Generate a basic summary
			const summary = `${segments.length} code segments found: ${segments.map((s) => s.type).join(", ")}`

			return {
				path: filePath,
				segments,
				imports,
				exports,
				summary,
			}
		} catch (error) {
			console.error(`Error parsing ${filePath}:`, error)
			return {
				path: filePath,
				segments: [],
				imports: [],
				exports: [],
				summary: `Error parsing file: ${error.message}`,
			}
		}
	}

	async getImportGraph(filePath: string): Promise<{ imports: string[]; importedBy: string[] }> {
		// TODO: Implement import graph analysis
		return {
			imports: [],
			importedBy: [],
		}
	}

	async getSymbolContext(filePath: string, line: number, column: number): Promise<string> {
		await this.initialize(filePath)

		const fileContent = await fs.readFile(filePath, "utf8")
		const ext = path.extname(filePath).toLowerCase().slice(1)
		const language = this.getLanguageFromExt(ext)

		const { parser } = this.languageParsers[language]
		if (!parser) {
			throw new Error(`Unsupported language: ${language}`)
		}

		const tree = parser.parse(fileContent)
		const point = { row: line, column }
		const node = tree.rootNode.descendantForPosition(point)

		if (!node) return ""

		// Walk up the tree to find relevant context
		let context = ""
		let current: Parser.SyntaxNode | null = node
		while (current) {
			if (["function", "class", "method", "module"].includes(current.type)) {
				context = `${current.type} ${current.text} > ${context}`
			}
			current = current.parent
		}

		return context.trim()
	}
}
