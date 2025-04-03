
async function Eme(e, t, r) {
	let n = t()
	if (!n || e?.document.uri.fsPath !== Gn.Uri.file(n).fsPath) return
	let i = r.get("memoriesFileOpenCount") ?? 0
	await r.update("memoriesFileOpenCount", i + 1)
}