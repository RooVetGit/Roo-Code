/**
 * Extensions that should always use fallback chunking instead of tree-sitter parsing.
 * These are typically languages that don't have a proper WASM parser available
 * or where the parser doesn't work correctly.
 *
 * NOTE: Only extensions that are already in the supported extensions list can be added here.
 * To add support for new file types, they must first be added to the tree-sitter extensions list.
 *
 * HOW TO ADD A NEW FALLBACK EXTENSION:
 * 1. First ensure the extension is in src/services/tree-sitter/index.ts extensions array
 * 2. Add the extension to the fallbackExtensions array below
 * 3. Remove any parser case for this extension from src/services/tree-sitter/languageParser.ts
 * 4. The file will automatically use length-based chunking for indexing
 */
export const fallbackExtensions = [
	".vb", // Visual Basic .NET - no dedicated WASM parser
	".scala", // Scala - removed from parser, uses fallback chunking
]

/**
 * Check if a file extension should use fallback chunking
 * @param extension File extension (including the dot)
 * @returns true if the extension should use fallback chunking
 */
export function shouldUseFallbackChunking(extension: string): boolean {
	return fallbackExtensions.includes(extension.toLowerCase())
}
