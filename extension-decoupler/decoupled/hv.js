
function Hv(e, t) {
	Error.call(this),
		(this.name = "YAMLException"),
		(this.reason = e),
		(this.mark = t),
		(this.message = iK(this, !1)),
		Error.captureStackTrace
			? Error.captureStackTrace(this, this.constructor)
			: (this.stack = new Error().stack || "")
}