
async function lgt(e) {
	try {
		let t
		if (lCe(e)) t = tM(e)
		else if (Pn(e.absPath)) t = await Ic.workspace.openTextDocument(e.absPath)
		else {
			let r = Ic.Uri.file(e.absPath)
			await Ic.workspace.fs.writeFile(r, Buffer.from("")), (t = await Ic.workspace.openTextDocument(r))
		}
		if (t === void 0) throw new Error(`Failed to open document ${e.absPath}`)
		return t
	} catch {
		return
	}
}