
var kr = class e extends Error {
	status
	constructor(t, r) {
		super(r), (this.status = t)
	}
	static transientIssue(t) {
		return new e(He.unavailable, t)
	}
	static fromResponse(t) {
		return new e(vMe(t.status), `HTTP error: ${t.status} ${t.statusText}`)
	}
	static isAPIErrorWithStatus(t, r) {
		return t instanceof e ? t.status === r : !1
	}
	static isRetriableAPIError(t) {
		return t instanceof e ? EMe.has(t.status) : !1
	}
}