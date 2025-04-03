
function TNe(e) {
	;(this.schema = e.schema || aK),
		(this.indent = Math.max(1, e.indent || 2)),
		(this.noArrayIndent = e.noArrayIndent || !1),
		(this.skipInvalid = e.skipInvalid || !1),
		(this.flowLevel = Ui.isNothing(e.flowLevel) ? -1 : e.flowLevel),
		(this.styleMap = SNe(this.schema, e.styles || null)),
		(this.sortKeys = e.sortKeys || !1),
		(this.lineWidth = e.lineWidth || 80),
		(this.noRefs = e.noRefs || !1),
		(this.noCompatMode = e.noCompatMode || !1),
		(this.condenseFlow = e.condenseFlow || !1),
		(this.quotingType = e.quotingType === '"' ? Gv : DNe),
		(this.forceQuotes = e.forceQuotes || !1),
		(this.replacer = typeof e.replacer == "function" ? e.replacer : null),
		(this.implicitTypes = this.schema.compiledImplicit),
		(this.explicitTypes = this.schema.compiledExplicit),
		(this.tag = null),
		(this.result = ""),
		(this.duplicates = []),
		(this.usedDuplicates = null)
}