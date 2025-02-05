import * as fs from "fs/promises"
import * as path from "path"
import { loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import type Parser from "web-tree-sitter"
import { CodeSegment, ParsedFile, SemanticParser, IMPORTANCE_WEIGHTS, CodeSegmentType } from "./types"
import * as queries from "./queries"
import crypto from "crypto"

export class TreeSitterParser implements SemanticParser {
	private languageParsers: Record<string, { parser: Parser; query: Parser.Query }> = {}
	private initialized = false
	private wasmDir: string

	constructor(
		private extensionPath: string,
		wasmDir?: string,
	) {
		// Use extension context's path as base directory
		this.wasmDir = wasmDir || path.join(this.extensionPath, "dist")
	}

	private async initialize(filePath: string) {
		if (!this.initialized) {
			try {
				// Create dummy files for all supported languages to ensure parsers are loaded
				const dummyFiles = Object.entries(this.getLanguageMap()).map(([ext]) => `dummy.${ext}`)
				this.languageParsers = await loadRequiredLanguageParsers(
					[filePath, ...dummyFiles],
					{
						ts: queries.typescript,
						js: queries.javascript,
						py: queries.python,
					},
					this.wasmDir,
				) // Pass wasmDir to loadRequiredLanguageParsers
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

	private getSymbolNameFromCapture(type: string, node: Parser.SyntaxNode): string {
		switch (type) {
			case CodeSegmentType.CLASS:
				return node.childForFieldName("name")?.text || ""
			case CodeSegmentType.FUNCTION:
				return node.childForFieldName("name")?.text || ""
			case CodeSegmentType.METHOD:
				return node.childForFieldName("name")?.text || ""
			case CodeSegmentType.VARIABLE:
				// First try direct name field, then look for identifier in descendants
				return node.childForFieldName("name")?.text || node.descendantsOfType("identifier")[0]?.text || ""
			case CodeSegmentType.IMPORT:
				// Try to get the module name from a dotted_name node
				const dotted = node.descendantsOfType("dotted_name")[0]
				if (dotted) return dotted.text
				// Fallback: try to find a string literal (if any)
				return node
					.descendantsOfType("string")
					.map((n) => n.text.replace(/['"]/g, ""))
					.join(", ")
			default:
				return ""
		}
	}

	private async parseSegments(tree: Parser.Tree, language: string): Promise<CodeSegment[]> {
		const segments: CodeSegment[] = []
		const ext = Object.entries(this.getLanguageMap()).find(([_, lang]) => lang === language)?.[0]

		if (!ext || !this.languageParsers[ext]) {
			return segments
		}

		const { query } = this.languageParsers[ext]
		const processedNodeIds = new Set<number>()

		//console.log("\n=== First Pass ===")
		// First pass: Process class bodies and mark their methods as processed
		for (const capture of query.captures(tree.rootNode)) {
			const { node, name } = capture
			if (name === "class") {
				//console.log("Found class node:", node.type)
				const methodNodes = node.descendantsOfType(["method_definition"])
				//console.log("Method nodes found:", methodNodes.length)

				methodNodes.forEach((methodNode) => {
					const methodName = methodNode.childForFieldName("name")?.text
					//console.log("Processing method:", methodName, "type:", methodNode.type, "id:", methodNode.id)
					// Don't add to processedNodeIds here anymore - we want to process it in the second pass
				})
			}
		}

		//console.log("\n=== Second Pass ===")
		//console.log(`Query captures for ${language}:`)
		for (const capture of query.captures(tree.rootNode)) {
			const { node, name } = capture
			//console.log(`- Capture name: ${name}, Node type: ${node.type}, Text: ${node.text.slice(0, 40)}...`)

			// Only skip if we've already processed this specific node
			if (processedNodeIds.has(node.id)) {
				//console.log("Node already processed, skipping. id:", node.id)
				continue
			}

			const type = Object.values(CodeSegmentType).includes(name as CodeSegmentType)
				? (name as CodeSegmentType)
				: null

			if (!type) {
				//console.log("No type found for capture:", name)
				continue
			}

			// Process the node and add it to segments
			const startLine = node.startPosition.row
			const endLine = node.endPosition.row
			const content = node.text

			// Get hierarchical context
			const contextParts: string[] = []
			let parent: Parser.SyntaxNode | null = node.parent
			while (parent) {
				if (parent.type === "class_declaration") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						contextParts.unshift(nameNode.text)
					}
				}
				parent = parent.parent
			}

			const symbolName = this.getSymbolNameFromCapture(type, node)
			const context = contextParts.join(" > ")

			segments.push({
				type: type as CodeSegmentType,
				name: symbolName,
				content,
				startLine,
				endLine,
				context,
				importance: IMPORTANCE_WEIGHTS[type.toUpperCase() as keyof typeof IMPORTANCE_WEIGHTS] || 0.5,
				language,
			})

			// Mark as processed after we've created the segment
			processedNodeIds.add(node.id)
		}

		return segments
	}

	async parseFile(filePath: string, expectedHash?: string): Promise<ParsedFile | null> {
		// Add file size check
		const stats = await fs.stat(filePath)
		if (stats.size > 2 * 1024 * 1024) {
			// 2MB limit
			return null
		}

		const fileContent = await fs.readFile(filePath, "utf8")
		const currentHash = crypto.createHash("sha256").update(fileContent).digest("hex")

		if (expectedHash && currentHash !== expectedHash) {
			return null
		}

		await this.initialize(filePath)

		const ext = path.extname(filePath).toLowerCase().slice(1)
		const language = this.getLanguageFromExt(ext)

		if (!this.languageParsers[ext]) {
			return null
		}

		try {
			const { parser } = this.languageParsers[ext]
			const tree = parser.parse(fileContent)
			const segments = await this.parseSegments(tree, language)

			const imports = segments
				.filter((s) => s.type === CodeSegmentType.IMPORT)
				.map((s) => s.name)
				.filter(Boolean)

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
			return null
		}
	}

	async getImportGraph(filePath: string): Promise<{ imports: string[]; importedBy: string[] }> {
		await this.initialize(filePath)
		const fileContent = await fs.readFile(filePath, "utf8")
		const ext = path.extname(filePath).toLowerCase().slice(1)

		if (!this.languageParsers[ext]) {
			return { imports: [], importedBy: [] }
		}

		const { parser, query } = this.languageParsers[ext]
		const tree = parser.parse(fileContent)
		const imports: string[] = []

		// Use the existing query to find import sources
		for (const capture of query.captures(tree.rootNode)) {
			if (capture.name === "import-source") {
				const importPath = capture.node.text.replace(/['"]/g, "")
				imports.push(importPath)
			}
		}

		return { imports, importedBy: [] }
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
