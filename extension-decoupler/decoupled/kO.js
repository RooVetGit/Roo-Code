
function Ko(e) {
	try {
		return Wk.default.gte(Hx.version, e)
	} catch {
		return agt.error(`Failed to parse vscode version: ${Hx.version}`), !1
	}
}