
async function Gyt(e, t) {
	let r = P_.Uri.joinPath(e, t)
	try {
		let n = await Fr(r.fsPath),
			i = (0, k8.default)({ ignorecase: !1 })
		return i.add(n), i
	} catch {}
}