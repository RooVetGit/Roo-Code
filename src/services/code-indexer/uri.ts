import * as URI from "uri-js"

export function getCleanUriPath(uri: string) {
	const path = URI.parse(uri).path ?? ""
	const clean = path.replace(/^\//, "") // Remove start slash.
	return clean.replace(/\/$/, "") // Remove end slash.
}

export function getUriPathBasename(uri: string): string {
	const path = getCleanUriPath(uri)
	const basename = path.split("/").pop() || ""
	return decodeURIComponent(basename)
}

export function getFileExtensionFromBasename(basename: string) {
	const parts = basename.split(".")
	return parts.length < 2 ? "" : (parts.slice(-1)[0] ?? "").toLowerCase()
}

export function getUriFileExtension(uri: string) {
	return getFileExtensionFromBasename(getUriPathBasename(uri))
}
