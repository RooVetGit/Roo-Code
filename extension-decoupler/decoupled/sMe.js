
function Sme(e) {
	return e
		? ((e.selections = e.selections.map((t) => {
				if (e.document.getText(t).trim() === "") return t
				let n = Ime(t, e.document)
				return t.active.isBefore(t.anchor) ? new Di.Selection(n.end, n.start) : new Di.Selection(n.start, n.end)
			})),
			!0)
		: !1
}