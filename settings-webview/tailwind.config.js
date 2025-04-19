/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				// VS Code theme colors
				"vscode-bg": "var(--vscode-editor-background)",
				"vscode-fg": "var(--vscode-editor-foreground)",
				"vscode-button-bg": "var(--vscode-button-background)",
				"vscode-button-fg": "var(--vscode-button-foreground)",
				"vscode-button-hover-bg": "var(--vscode-button-hoverBackground)",
				"vscode-input-bg": "var(--vscode-input-background)",
				"vscode-input-fg": "var(--vscode-input-foreground)",
				"vscode-input-border": "var(--vscode-input-border)",
				"vscode-dropdown-bg": "var(--vscode-dropdown-background)",
				"vscode-dropdown-fg": "var(--vscode-dropdown-foreground)",
				"vscode-dropdown-border": "var(--vscode-dropdown-border)",
				"vscode-panel-bg": "var(--vscode-panel-background)",
				"vscode-panel-border": "var(--vscode-panel-border)",
				"vscode-focus-border": "var(--vscode-focusBorder)",
				"vscode-description-fg": "var(--vscode-descriptionForeground)",
			},
			borderColor: {
				DEFAULT: "var(--vscode-panel-border)",
			},
		},
	},
	plugins: [],
}
