import * as cheerio from "cheerio"

/**
 * @typedef {Object} AnalysisResult
 * @property {boolean} needsJavaScript
 * @property {string} conclusion
 * @property {number} score
 * @property {Object} details
 */

/**
 * Analyzes a website's HTML to determine if it likely requires JavaScript to render meaningful content.
 * Uses fetch API instead of axios.
 *
 * @param {string} url The URL of the website to analyze.
 * @returns {Promise<{
 *   needsJavaScript: boolean,
 *   score: number,
 *   details: {
 *     bodyTextLength: number,
 *     meaningfulTagCount: number,
 *     scriptTagCount: number,
 *     hasAppRoot: boolean,
 *     hasNoScriptTag: boolean,
 *     rootElementIsEmpty: boolean,
 *   }
 * }>}
 */
export function analyzeWebsite(html: string) {
	const details = {
		bodyTextLength: 0,
		meaningfulTagCount: 0,
		scriptTagCount: 0,
		hasAppRoot: false,
		hasNoScriptTag: false,
		rootElementIsEmpty: false,
	}

	let score = 0

	try {
		const $ = cheerio.load(html)

		if ($("noscript").length > 0) {
			details.hasNoScriptTag = true
			score -= 50
		}

		const bodyText = $("body").text().replace(/\s+/g, " ").trim()
		details.bodyTextLength = bodyText.length
		if (bodyText.length < 200) {
			score -= 20
		} else {
			score += 10
		}

		const appRootSelectors = "#root, #app, #__next, [data-reactroot]"
		const $appRoot = $(appRootSelectors)
		if ($appRoot.length > 0) {
			details.hasAppRoot = true
			score -= 15
			if ($appRoot.text().trim().length < 50 && $appRoot.children().length === 0) {
				details.rootElementIsEmpty = true
				score -= 25
			}
		}
		// Detect if the page is a Next.js app
		const scriptSelectors = "script#__NEXT_DATA__"
		if ($(scriptSelectors).length > 0) {
			if ($(scriptSelectors).text().trim().length < 100) {
				score -= 10
			} else {
				score += 10
			}
		}

		const meaningfulTags = "p, h1, h2, h3, article, section, li, a"
		const tagCount = $(meaningfulTags).length
		details.meaningfulTagCount = tagCount
		if (tagCount > 20) {
			score += 25
		} else if (tagCount < 5) {
			score -= 10
		}

		details.scriptTagCount = $("script[src]").length
		if (details.scriptTagCount > 3) {
			score -= 5 * details.scriptTagCount
		}

		const needsJavaScript = score < 0

		return {
			needsJavaScript,
			score,
			details,
		}
	} catch (error: any) {
		throw new Error(`Failed to process HTML. Reason: ${error.message}`)
	}
}
