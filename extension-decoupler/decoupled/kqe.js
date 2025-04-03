
function KQe(e, t) {
	;(this.input = e),
		(this.filename = t.filename || null),
		(this.schema = t.schema || aK),
		(this.onWarning = t.onWarning || null),
		(this.legacy = t.legacy || !1),
		(this.json = t.json || !1),
		(this.listener = t.listener || null),
		(this.implicitTypes = this.schema.compiledImplicit),
		(this.typeMap = this.schema.compiledTypeMap),
		(this.length = e.length),
		(this.position = 0),
		(this.line = 0),
		(this.lineStart = 0),
		(this.lineIndent = 0),
		(this.firstTabInLine = -1),
		(this.documents = [])
}