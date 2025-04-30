export const bundledLanguages = {
	javascript: {},
	typescript: {},
	html: {},
	css: {},
	json: {},
	markdown: {},
}

export type ShikiTransformer = {
	name: string
	transform: (hast: any, options: any) => any
}

export const codeToHast = jest.fn()
export const codeToHtml = jest.fn()
export const codeToTokens = jest.fn()
export const codeToTokensBase = jest.fn()
export const codeToTokensWithThemes = jest.fn()
export const createHighlighter = jest.fn()
export const getLastGrammarState = jest.fn()
export const getSingletonHighlighter = jest.fn()
