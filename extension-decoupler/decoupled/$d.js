
async function $d(e) {
	try {
		return (await ai.stat(e)).isDirectory()
	} catch {
		return !1
	}
}