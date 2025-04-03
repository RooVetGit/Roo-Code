
var NF = class e extends Error {
	name
	constructor(t) {
		super(t), (this.name = "CodeExpectedError")
	}
	static fromError(t) {
		if (t instanceof e) return t
		let r = new e()
		return (r.message = t.message), (r.stack = t.stack), r
	}
	static isErrorNoTelemetry(t) {
		return t.name === "CodeExpectedError"
	}
}