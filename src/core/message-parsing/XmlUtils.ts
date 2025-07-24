export class XmlUtils {
	static hasIncompleteXml(input: string): boolean {
		const openTags: string[] = []
		const tagRegex = /<\/?([a-zA-Z_][a-zA-Z0-9_-]*)[^>]*>/g
		let match

		while ((match = tagRegex.exec(input)) !== null) {
			const fullTag = match[0]
			const tagName = match[1]

			if (fullTag.startsWith("</")) {
				const lastOpenTag = openTags.pop()
				if (lastOpenTag !== tagName) {
					return true
				}
			} else if (!fullTag.endsWith("/>")) {
				openTags.push(tagName)
			}
		}

		return openTags.length > 0
	}
}
