import * as fs from "fs/promises"
import * as path from "path"
import { listFiles } from "../glob/list-files"
import { LanguageParser, loadRequiredLanguageParsers } from "./languageParser"
import { fileExistsAtPath } from "../../utils/fs"
import { parseMarkdown, formatMarkdownCaptures } from "./markdownParser"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"

const extensions = [
	"js",
	"jsx",
	"ts",
	"tsx",
	"py",
	"pyi",
	// Rust
	"rs",
	"go",
	// C
	"c",
	"h",
	// C++
	"cpp",
	"hpp",
	"cc",
	// C#
	"cs",
	// Ruby
	"rb",
	"java",
	"php",
	"swift",
	// Kotlin
	"kt",
	"kts",
	// Markdown
	"md",
	"markdown",
	// JSON
	"json",
].map((e) => `.${e}`)

export async function parseSourceCodeDefinitionsForFile(
	filePath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | undefined> {
	// check if the file exists
	const fileExists = await fileExistsAtPath(path.resolve(filePath))
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it."
	}

	// Get file extension to determine parser
	const ext = path.extname(filePath).toLowerCase()
	// Check if the file extension is supported
	if (!extensions.includes(ext)) {
		return undefined
	}

	// Special case for markdown files
	if (ext === ".md" || ext === ".markdown") {
		// Check if we have permission to access this file
		if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
			return undefined
		}

		// Read file content
		const fileContent = await fs.readFile(filePath, "utf8")

		// Split the file content into individual lines
		const lines = fileContent.split("\n")

		// Parse markdown content to get captures
		const markdownCaptures = parseMarkdown(fileContent)

		// Process the captures
		const markdownDefinitions = processCaptures(markdownCaptures, lines, 4)

		if (markdownDefinitions) {
			return `# ${path.basename(filePath)}\n${markdownDefinitions}`
		}
		return undefined
	}

	// For other file types, load parser and use tree-sitter
	const languageParsers = await loadRequiredLanguageParsers([filePath])

	// Parse the file if we have a parser for it
	const definitions = await parseFile(filePath, languageParsers, rooIgnoreController)
	if (definitions) {
		return `# ${path.basename(filePath)}\n${definitions}`
	}

	return undefined
}

// TODO: implement caching behavior to avoid having to keep analyzing project for new tasks.
export async function parseSourceCodeForDefinitionsTopLevel(
	dirPath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	// check if the path exists
	const dirExists = await fileExistsAtPath(path.resolve(dirPath))
	if (!dirExists) {
		return "This directory does not exist or you do not have permission to access it."
	}

	// Get all files at top level (not gitignored)
	const [allFiles, _] = await listFiles(dirPath, false, 200)

	let result = ""

	// Separate files to parse and remaining files
	const { filesToParse, remainingFiles } = separateFiles(allFiles)

	// Filter filepaths for access if controller is provided
	const allowedFilesToParse = rooIgnoreController ? rooIgnoreController.filterPaths(filesToParse) : filesToParse

	// Separate markdown files from other files
	const markdownFiles: string[] = []
	const otherFiles: string[] = []

	for (const file of allowedFilesToParse) {
		const ext = path.extname(file).toLowerCase()
		if (ext === ".md" || ext === ".markdown") {
			markdownFiles.push(file)
		} else {
			otherFiles.push(file)
		}
	}

	// Load language parsers only for non-markdown files
	const languageParsers = await loadRequiredLanguageParsers(otherFiles)

	// Process markdown files
	for (const file of markdownFiles) {
		// Check if we have permission to access this file
		if (rooIgnoreController && !rooIgnoreController.validateAccess(file)) {
			continue
		}

		try {
			// Read file content
			const fileContent = await fs.readFile(file, "utf8")

			// Split the file content into individual lines
			const lines = fileContent.split("\n")

			// Parse markdown content to get captures
			const markdownCaptures = parseMarkdown(fileContent)

			// Process the captures
			const markdownDefinitions = processCaptures(markdownCaptures, lines, 4)

			if (markdownDefinitions) {
				result += `# ${path.relative(dirPath, file).toPosix()}\n${markdownDefinitions}\n`
			}
		} catch (error) {
			console.log(`Error parsing markdown file: ${error}\n`)
		}
	}

	// Process other files using tree-sitter
	for (const file of otherFiles) {
		const definitions = await parseFile(file, languageParsers, rooIgnoreController)
		if (definitions) {
			result += `# ${path.relative(dirPath, file).toPosix()}\n${definitions}\n`
		}
	}

	return result ? result : "No source code definitions found."
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
 * @param lines - The lines of the file
 * @param minComponentLines - Minimum number of lines for a component to be included
 * @returns A formatted string with definitions
 */
function processCaptures(captures: any[], lines: string[], minComponentLines: number = 4): string | null {
	// Filter function to exclude HTML elements
	const isNotHtmlElement = (line: string): boolean => {
		// Common HTML elements pattern
		const HTML_ELEMENTS = /^[^A-Z]*<\/?(?:div|span|button|input|h[1-6]|p|a|img|ul|li|form)\b/
		const trimmedLine = line.trim()
		return !HTML_ELEMENTS.test(trimmedLine)
	}

	// No definitions found
	if (captures.length === 0) {
		return null
	}

	let formattedOutput = ""

	// Sort captures by their start position
	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

	// Keep track of the last line we've processed
	let lastLine = -1

	// Track already processed lines to avoid duplicates
	const processedLines = new Set<string>()

	// First pass - categorize captures by type
	captures.forEach((capture) => {
		const { node, name } = capture

		// Skip captures that don't represent definitions
		if (!name.includes("definition") && !name.includes("name")) {
			return
		}

		// Get the parent node that contains the full definition
		const definitionNode = name.includes("name") ? node.parent : node
		if (!definitionNode) return

		// Get the start and end lines of the full definition
		const startLine = definitionNode.startPosition.row
		const endLine = definitionNode.endPosition.row
		const lineCount = endLine - startLine + 1

		// Skip components that don't span enough lines
		if (lineCount < minComponentLines) {
			return
		}

		// Create unique key for this definition based on line range
		// This ensures we don't output the same line range multiple times
		const lineKey = `${startLine}-${endLine}`

		// Skip already processed lines
		if (processedLines.has(lineKey)) {
			return
		}

		// Check if this is a valid component definition (not an HTML element)
		const startLineContent = lines[startLine].trim()

		// Special handling for component name definitions
		if (name.includes("name.definition")) {
			// Extract component name
			const componentName = node.text

			// Add component name to output regardless of HTML filtering
			if (!processedLines.has(lineKey) && componentName) {
				formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
				processedLines.add(lineKey)
			}
		}
		// For other component definitions
		else if (isNotHtmlElement(startLineContent)) {
			formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
			processedLines.add(lineKey)

			// If this is part of a larger definition, include its non-HTML context
			if (node.parent && node.parent.lastChild) {
				const contextEnd = node.parent.lastChild.endPosition.row
				const contextSpan = contextEnd - node.parent.startPosition.row + 1

				// Only include context if it spans multiple lines
				if (contextSpan >= minComponentLines) {
					// Add the full range first
					const rangeKey = `${node.parent.startPosition.row}-${contextEnd}`
					if (!processedLines.has(rangeKey)) {
						formattedOutput += `${node.parent.startPosition.row + 1}--${contextEnd + 1} | ${lines[node.parent.startPosition.row]}\n`
						processedLines.add(rangeKey)
					}
				}
			}
		}

		lastLine = endLine
	})

	if (formattedOutput.length > 0) {
		return formattedOutput
	}
	return null
}

/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param rooIgnoreController - Optional controller to check file access permissions
 * @returns A formatted string with code definitions or null if no definitions found
 */
async function parseFile(
	filePath: string,
	languageParsers: LanguageParser,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | null> {
	// Minimum number of lines for a component to be included
	const MIN_COMPONENT_LINES = 4

	// Check if we have permission to access this file
	if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
		return null
	}

	// Read file content
	const fileContent = await fs.readFile(filePath, "utf8")
	const ext = path.extname(filePath).toLowerCase().slice(1)

	// Check if we have a parser for this file type
	const { parser, query } = languageParsers[ext] || {}
	if (!parser || !query) {
		return `Unsupported file type: ${filePath}`
	}

	try {
		// Parse the file content into an Abstract Syntax Tree (AST)
		const tree = parser.parse(fileContent)

		// Apply the query to the AST and get the captures
		const captures = query.captures(tree.rootNode)

		// Split the file content into individual lines
		const lines = fileContent.split("\n")

		// Process the captures
		return processCaptures(captures, lines, MIN_COMPONENT_LINES)
	} catch (error) {
		console.log(`Error parsing file: ${error}\n`)
		// Return null on parsing error to avoid showing error messages in the output
		return null
	}
}

































export async function parseSourceCodeDefinitionsForFileAll(
	filePath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | undefined> {
	// check if the file exists
	const fileExists = await fileExistsAtPath(path.resolve(filePath))
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it."
	}

	// Get file extension to determine parser
	const ext = path.extname(filePath).toLowerCase()
	// Check if the file extension is supported
	if (!extensions.includes(ext)) {
		return undefined
	}

	// For other file types, load parser and use tree-sitter
	const languageParsers = await loadRequiredLanguageParsers([filePath])

	// Parse the file if we have a parser for it
	const definitions = await parseFileAll(filePath, languageParsers, rooIgnoreController)
	if (definitions) {
		return `# ${path.basename(filePath)}\n${definitions}`
	}

	return undefined
}


/**
 * 解析文件中完整的语法树并转化为JSON格式
 * 
 * @param filePath - 要解析的文件路径
 * @param languageParsers - 语言解析器映射
 * @param rooIgnoreController - 可选的文件访问权限控制器
 * @returns 包含语法树定义的JSON字符串，或者null（如果解析失败）
 */
export async function parseFileAll(
	filePath: string,
	languageParsers: LanguageParser,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | null> {
	// 检查是否有权限访问此文件
	if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
		return null
	}

	// 读取文件内容
	try {
		const fileContent = await fs.readFile(filePath, "utf8")
		const ext = path.extname(filePath).toLowerCase().slice(1)

		// 检查是否有此文件类型的解析器
		const { parser, query } = languageParsers[ext] || {}
		if (!parser || !query) {
			return JSON.stringify({ error: `Unsupported file type: ${ext}` })
		}

		// 解析文件内容为抽象语法树(AST)
		const tree = parser.parse(fileContent)
		
		// 将语法树转换为JSON格式，添加文件路径信息和文件内容（用于提取lineContent）
		const result = convertTreeToJson(tree.rootNode, filePath, fileContent)
		
		return JSON.stringify(result, null, 2)
	} catch (error) {
		console.error(`Error parsing file ${filePath}: ${error}`)
		return JSON.stringify({ error: `Failed to parse file: ${error.message}` })
	}
}

/**
 * 将Tree-sitter语法树节点转换为简化的JSON对象
 * 
 * @param node - Tree-sitter语法树节点
 * @param filePath - 当前解析的文件路径
 * @param fileContent - 文件内容（用于提取lineContent）
 * @returns 表示语法树的简化JSON对象
 */
function convertTreeToJson(node: any, filePath: string, fileContent: string): any {
	// 根节点特殊处理
	if (node.type === 'program') {
		const children = [];
		for (const child of node.children || []) {
			if (shouldIncludeNode(child)) {
				const childJson = convertNodeToSimplifiedJson(child, filePath, fileContent);
				if (childJson) {
					children.push(childJson);
				}
			}
		}
		return { 
			filePath: filePath.toPosix(),
			type: node.type,
			children
		};
	}
	
	return {type:'codebase', children:convertNodeToSimplifiedJson(node, filePath, fileContent), filePath: filePath.toPosix()};
}


function paresContent(node: any, filePath: string, fileContent: string): string | undefined {
	if (!node) return undefined;
	
	// 分割文件内容为行数组，用于提取lineContent
	const lines = fileContent.split('\n');
	let result = ""
	if (node.type.endsWith('declarator') 
		|| node.type.endsWith('declaration')
		|| node.type === 'struct'
		|| node.type === 'class'
	) {
		result = lines.slice(node.startPosition.row, node.endPosition.row + 1).map(line => line.trim()).join('\n');
		result = result.replace(/\s+/g, ' ');
	} else {
		result = lines[node.startPosition.row].trim();
	}
	return result
}

/**
 * 将单个节点转换为简化的JSON格式
 * 
 * @param node - 节点
 * @param filePath - 文件路径
 * @param fileContent - 文件内容（用于提取lineContent）
 * @returns 简化的JSON对象
 */
function convertNodeToSimplifiedJson(node: any, filePath: string, fileContent: string): any {
	if (!node) return null;
	
	// 分割文件内容为行数组，用于提取lineContent
	const lines = fileContent.split('\n');
	
	// 基础节点信息（包括开始和结束行，以及行内容）
	const result: any = {
		// filePath: filePath.toPosix(),
		type: node.type,
		startLine: node.startPosition.row+1,
		endLine: node.endPosition.row+1
	};

	const lineContent = paresContent(node, filePath, fileContent)
	if (lineContent) {
		result.lineContent = lineContent;
	}

	// 递归处理子节点
	if (node.children && node.children.length > 0) {
		result.children = [];
		for (const child of node.children) {
			// 只包含可能包含定义的节点
			if (shouldIncludeNode(child)) {
				const childJson = convertNodeToSimplifiedJson(child, filePath, fileContent);
				if (childJson) {
					result.children.push(childJson);
				}
			}
		}
		// 如果没有子节点，删除children属性
		if (result.children.length === 0) {
			delete result.children;
		}
	}
	
	return result;
}

/**
 * 判断节点类型是否为定义
 * 
 * @param type - 节点类型
 * @returns 是否为定义节点
 */
function isDefinition(type: string): boolean {
	const definitionTypes = [
		// 通用定义类型
		'definit', 'declarat',

		// JavaScript/TypeScript
		'class_definition', 'function_definition', 'method_definition',
		'variable_declarator', 'function_declaration', 'method_declaration',
		'class_declaration', 'interface_declaration', 'enum_declaration',
		'const_declaration', 'let_declaration', 'var_declaration',
		
		// C/C++
		'struct_specifier', 'enum_specifier', 'union_specifier',
		'function_definition', 'declaration', 'field_declaration',
		'typedef_declaration', 'namespace_definition', 'class_specifier',
		'template_declaration',
		
		// Python
		'class_definition', 'function_definition', 'import_statement',
		'assignment', 'global_statement', 'nonlocal_statement',
		'decorated_definition', 'with_statement', 'module'
	]
	return definitionTypes.some(defType => type.includes(defType) || type === defType)
}

/**
 * 判断节点是否应该包含在输出中
 * 
 * @param node - 节点
 * @returns 是否应该包含该节点
 */
function shouldIncludeNode(node: any): boolean {
	// 跳过注释、空白和简单字面量以及语句块
	// const skipTypes = [
	// 	// 通用
	// 	'comment', 'string', 'number', 'boolean', 'null',
	// 	'statement_block', 'return_statement', 'parenthesized_expression',
	// 	'expression_statement', 'assignment_expression', 'call_expression',
	// 	'binary_expression', 'unary_expression', 'member_expression',
	// 	'subscript_expression', 'block', 'expression',
		
	// 	// 控制流
	// 	'for_statement', 'if_statement', 'while_statement',
	// 	'do_statement', 'switch_statement', 'case_statement', 'break_statement',
	// 	'continue_statement', 'throw_statement', 'try_statement', 'catch_clause',
	// 	'finally_clause',
		
	// 	// C/C++ 特有
	// 	'compound_statement', 'expression_statement', 'labeled_statement',
	// 	'preproc_include', 'preproc_def', 'preproc_ifdef', 'preproc_else',
		
	// 	// Python 特有
	// 	'if_statement', 'for_statement', 'while_statement', 'return_statement',
	// 	'assert_statement', 'pass_statement', 'break_statement', 'continue_statement',
	// 	'raise_statement', 'try_statement', 'except_clause', 'finally_clause'
	// ]
	
	// // 如果是跳过列表中的类型，直接返回false
	// if (skipTypes.some(type => node.type.includes(type) || node.type === type)) {
	// 	return false;
	// }
	
	// 只包含与定义相关的节点
	const includeTypes = [
		// 通用
		'class', 'function', 'method', 'constructor',
		'property', 'variable', 'const', 'let', 'var',
		'interface', 'enum', 'struct', 'module',
		'declaration', 'definition', 'program',
		
		// C/C++ 特有
		'struct_specifier', 'enum_specifier', 'union_specifier',
		'typedef_declaration', 'namespace_definition', 'class_specifier',
		'template_declaration', 'field_declaration',
		
		// Python 特有
		'class_definition', 'function_definition', 'import_statement',
		'assignment', 'global_statement', 'nonlocal_statement',
		'decorated_definition', 'with_statement'
	]
	
	// 如果是定义类型或者包含在includeTypes中的类型，则包含
	return isDefinition(node.type) || 
		   includeTypes.some(type => node.type.includes(type) || node.type === type);
}
