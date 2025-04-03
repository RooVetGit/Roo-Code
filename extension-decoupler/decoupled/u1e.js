
function U1e(e, t) {
	if (
		((t = t || {}),
		Object.keys(t).forEach(function (r) {
			if (N1e.indexOf(r) === -1)
				throw new ko('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.')
		}),
		(this.options = t),
		(this.tag = e),
		(this.kind = t.kind || null),
		(this.resolve =
			t.resolve ||
			function () {
				return !0
			}),
		(this.construct =
			t.construct ||
			function (r) {
				return r
			}),
		(this.instanceOf = t.instanceOf || null),
		(this.predicate = t.predicate || null),
		(this.represent = t.represent || null),
		(this.representName = t.representName || null),
		(this.defaultStyle = t.defaultStyle || null),
		(this.multi = t.multi || !1),
		(this.styleAliases = L1e(t.styleAliases || null)),
		P1e.indexOf(this.kind) === -1)
	)
		throw new ko('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.')
}