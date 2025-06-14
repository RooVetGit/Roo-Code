export const STATIC_OPENING_TAG_REGEX = /<\s*([\w:-]+)((?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'|[^\s/>]+))?)*\s*)?(\/?)\>/
export const STATIC_CLOSING_TAG_REGEX = /<\/\s*([\w:-]+)\s*>/

export const COMMON_ENTITIES: Record<string, string> = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
}
