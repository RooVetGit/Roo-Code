import { readFile } from "fs/promises"
import path from "path"

import { Parser, Language, Node } from "web-tree-sitter"

import { getUriFileExtension } from "./uri"

export type CodeChunk = {
	chunk: string
	start: number
	end: number
	type: string
	filepath: string
}

const supportedTypes = [
	"function_definition",
	"class_definition",
	"method_definition",
	"function_declaration",
	"class_declaration",
	"method_declaration",
	"arrow_function",
	"export_statement",
]

export async function getChunks(filepath: string): Promise<CodeChunk[]> {
	const parser = await getParserForFile(filepath)
	const sourceCode = await readFile(filepath, "utf-8")
	const tree = parser.parse(sourceCode)
	const chunks: CodeChunk[] = []

	if (!tree) {
		throw new Error(`Failed to parse file: ${filepath}`)
	}

	const traverseNode = (node: Node) => {
		const { type, startIndex, endIndex } = node

		if (supportedTypes.includes(node.type)) {
			chunks.push({
				chunk: sourceCode.slice(startIndex, endIndex),
				start: startIndex,
				end: endIndex,
				type,
				filepath,
			})
		}

		for (let child of node.children) {
			if (child) {
				traverseNode(child)
			}
		}
	}

	traverseNode(tree.rootNode)

	return chunks
}

export enum LanguageName {
	CPP = "cpp",
	C_SHARP = "c_sharp",
	C = "c",
	CSS = "css",
	PHP = "php",
	BASH = "bash",
	JSON = "json",
	TYPESCRIPT = "typescript",
	TSX = "tsx",
	ELM = "elm",
	JAVASCRIPT = "javascript",
	PYTHON = "python",
	ELISP = "elisp",
	ELIXIR = "elixir",
	GO = "go",
	EMBEDDED_TEMPLATE = "embedded_template",
	HTML = "html",
	JAVA = "java",
	LUA = "lua",
	OCAML = "ocaml",
	QL = "ql",
	RESCRIPT = "rescript",
	RUBY = "ruby",
	RUST = "rust",
	SYSTEMRDL = "systemrdl",
	TOML = "toml",
	SOLIDITY = "solidity",
}

export const supportedLanguages: { [key: string]: LanguageName } = {
	cpp: LanguageName.CPP,
	hpp: LanguageName.CPP,
	cc: LanguageName.CPP,
	cxx: LanguageName.CPP,
	hxx: LanguageName.CPP,
	cp: LanguageName.CPP,
	hh: LanguageName.CPP,
	inc: LanguageName.CPP,
	cs: LanguageName.C_SHARP,
	c: LanguageName.C,
	h: LanguageName.C,
	css: LanguageName.CSS,
	php: LanguageName.PHP,
	phtml: LanguageName.PHP,
	php3: LanguageName.PHP,
	php4: LanguageName.PHP,
	php5: LanguageName.PHP,
	php7: LanguageName.PHP,
	phps: LanguageName.PHP,
	"php-s": LanguageName.PHP,
	bash: LanguageName.BASH,
	sh: LanguageName.BASH,
	json: LanguageName.JSON,
	ts: LanguageName.TYPESCRIPT,
	mts: LanguageName.TYPESCRIPT,
	cts: LanguageName.TYPESCRIPT,
	tsx: LanguageName.TSX,
	elm: LanguageName.ELM,
	js: LanguageName.JAVASCRIPT,
	jsx: LanguageName.JAVASCRIPT,
	mjs: LanguageName.JAVASCRIPT,
	cjs: LanguageName.JAVASCRIPT,
	py: LanguageName.PYTHON,
	pyw: LanguageName.PYTHON,
	pyi: LanguageName.PYTHON,
	el: LanguageName.ELISP,
	emacs: LanguageName.ELISP,
	ex: LanguageName.ELIXIR,
	exs: LanguageName.ELIXIR,
	go: LanguageName.GO,
	eex: LanguageName.EMBEDDED_TEMPLATE,
	heex: LanguageName.EMBEDDED_TEMPLATE,
	leex: LanguageName.EMBEDDED_TEMPLATE,
	html: LanguageName.HTML,
	htm: LanguageName.HTML,
	java: LanguageName.JAVA,
	lua: LanguageName.LUA,
	ocaml: LanguageName.OCAML,
	ml: LanguageName.OCAML,
	mli: LanguageName.OCAML,
	ql: LanguageName.QL,
	res: LanguageName.RESCRIPT,
	resi: LanguageName.RESCRIPT,
	rb: LanguageName.RUBY,
	erb: LanguageName.RUBY,
	rs: LanguageName.RUST,
	rdl: LanguageName.SYSTEMRDL,
	toml: LanguageName.TOML,
	sol: LanguageName.SOLIDITY,
}

async function getParserForFile(filepath: string) {
	await Parser.init()
	const parser = new Parser()
	const language = await getLanguageForFile(filepath)

	if (!language) {
		throw new Error(`Unsupported language: ${filepath}`)
	}

	parser.setLanguage(language)
	return parser
}

// Loading the wasm files to create a Language object is an expensive operation
// and with sufficient number of files can result in errors, instead keep a map
// of language name to Language object.
const languageMap = new Map<string, Language>()

export async function getLanguageForFile(filepath: string) {
	try {
		await Parser.init()
		const extension = getUriFileExtension(filepath)
		const languageName = supportedLanguages[extension]

		if (!languageName) {
			return undefined
		}

		let language = languageMap.get(languageName)

		if (!language) {
			const wasmPath = path.join(
				process.env.NODE_ENV === "test"
					? path.join(process.cwd(), "node_modules", "tree-sitter-wasms", "out")
					: path.join(__dirname, "tree-sitter-wasms"),
				`tree-sitter-${supportedLanguages[extension]}.wasm`,
			)

			language = await Language.load(wasmPath)
			languageMap.set(languageName, language)
		}

		return language
	} catch (e) {
		console.debug("Unable to load language for file", filepath, e)
		return undefined
	}
}
