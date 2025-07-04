// Worker-compatible version of supported extensions
// Defines extensions directly without importing from tree-sitter

const allExtensions = [
	".tla",
	".js",
	".jsx",
	".ts",
	".vue",
	".tsx",
	".py",
	// Rust
	".rs",
	".go",
	// C
	".c",
	".h",
	// C++
	".cpp",
	".hpp",
	// C#
	".cs",
	// Ruby
	".rb",
	".java",
	".php",
	".swift",
	// Solidity
	".sol",
	// Kotlin
	".kt",
	".kts",
	// Elixir
	".ex",
	".exs",
	// Elisp
	".el",
	// HTML
	".html",
	".htm",
	// Markdown
	".md",
	".markdown",
	// JSON
	".json",
	// CSS
	".css",
	// SystemRDL
	".rdl",
	// OCaml
	".ml",
	".mli",
	// Lua
	".lua",
	// Scala
	".scala",
	// TOML
	".toml",
	// Zig
	".zig",
	// Elm
	".elm",
	// Embedded Template
	".ejs",
	".erb",
]

// Filter out markdown extensions for the scanner
export const scannerExtensions = allExtensions.filter((ext) => ext !== ".md" && ext !== ".markdown")
