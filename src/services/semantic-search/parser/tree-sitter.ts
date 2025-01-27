import * as fs from "fs/promises"
import * as path from "path"
import { loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import type Parser from "web-tree-sitter"
import { CodeSegment, ParsedFile, SemanticParser, IMPORTANCE_WEIGHTS, CodeSegmentType } from "./types"
import typescript from "./queries/typescript"
import javascript from "./queries/javascript"
import crypto from "crypto"

export class TreeSitterParser implements SemanticParser {
	private languageParsers: Record<string, { parser: Parser; query: Parser.Query }> = {}
	private initialized = false
	private wasmDir: string

	constructor(wasmDir?: string) {
		// In tests, use the provided wasmDir, otherwise use the default
		this.wasmDir = wasmDir || __dirname
	}

	private async initialize(filePath: string) {
		if (!this.initialized) {
			try {
				// Create dummy files for all supported languages to ensure parsers are loaded
				const dummyFiles = Object.entries(this.getLanguageMap()).map(([ext]) => `dummy.${ext}`)
				this.languageParsers = await loadRequiredLanguageParsers(
					[filePath, ...dummyFiles],
					{
						ts: typescript,
						js: javascript,
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
				return node
					.descendantsOfType("string")
					.map((n) => n.text.replace(/['"]/g, ""))
					.join(", ")
			default:
				return ""
		}
	}

	private async parseSegments(tree: Parser.Tree, fileContent: string, language: string): Promise<CodeSegment[]> {
		const segments: CodeSegment[] = []
		const ext = Object.entries(this.getLanguageMap()).find(([_, lang]) => lang === language)?.[0]

		if (!ext || !this.languageParsers[ext]) {
			return segments
		}

		const { query } = this.languageParsers[ext]
		const processedNodeIds = new Set<number>()

		console.log("\n=== First Pass ===")
		// First pass: Process class bodies and mark their methods as processed
		for (const capture of query.captures(tree.rootNode)) {
			const { node, name } = capture
			if (name === "class") {
				console.log("Found class node:", node.type)
				const methodNodes = node.descendantsOfType(["method_definition"])
				console.log("Method nodes found:", methodNodes.length)

				methodNodes.forEach((methodNode) => {
					const methodName = methodNode.childForFieldName("name")?.text
					console.log("Processing method:", methodName, "type:", methodNode.type, "id:", methodNode.id)
					// Don't add to processedNodeIds here anymore - we want to process it in the second pass
				})
			}
		}

		console.log("\n=== Second Pass ===")
		console.log(`Query captures for ${language}:`)
		for (const capture of query.captures(tree.rootNode)) {
			const { node, name } = capture
			console.log(`- Capture name: ${name}, Node type: ${node.type}, Text: ${node.text.slice(0, 40)}...`)

			// Only skip if we've already processed this specific node
			if (processedNodeIds.has(node.id)) {
				console.log("Node already processed, skipping. id:", node.id)
				continue
			}

			const type = Object.values(CodeSegmentType).includes(name as CodeSegmentType)
				? (name as CodeSegmentType)
				: null

			if (!type) {
				console.log("No type found for capture:", name)
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

	async parseFile(filePath: string, expectedHash?: string): Promise<ParsedFile> {
		// Check hash before any processing
		const fileContent = await fs.readFile(filePath, "utf8")
		const currentHash = crypto.createHash("sha256").update(fileContent).digest("hex")

		if (expectedHash && currentHash !== expectedHash) {
			console.log(`Hash mismatch during parsing, skipping: ${filePath}`)
			return {
				path: filePath,
				segments: [],
				imports: [],
				exports: [],
				summary: "Skipped due to hash mismatch",
			}
		}

		await this.initialize(filePath)

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

			// Extract imports and exports from segments
			const imports = segments
				.filter((s) => s.type === CodeSegmentType.IMPORT)
				.map((s) => s.name)
				.filter(Boolean)

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
