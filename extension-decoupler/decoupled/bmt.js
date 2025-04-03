
function Bmt(e = {}, t) {
	let r = pEe(e),
		n = ["stash", "list", ...r.commands, ...t],
		i = dEe(r.splitter, r.fields, gG(n))
	return GM(n) || { commands: n, format: "utf-8", parser: i }
}