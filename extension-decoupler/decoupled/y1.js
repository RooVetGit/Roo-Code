
var Y1 = class e extends Zn {
	constructor(r, n, i, s) {
		super(
			"NextEditSessionEventReporter",
			n ?? e.defaultMaxRecords,
			i ?? e.defaultUploadMsec,
			s ?? e.defaultBatchSize,
		)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportEvent(r, n, i, s, o) {
		let [a, l] = kn(i)
		this.report({
			related_request_id: r,
			related_suggestion_id: n,
			event_time_sec: a,
			event_time_nsec: l,
			event_name: s,
			event_source: o,
		})
	}
	reportEventFromSuggestion(r, n, i) {
		this.reportEvent(r?.requestId, r?.result.suggestionId, Date.now(), n, i)
	}
	reportEventWithoutIds(r, n) {
		this.reportEvent(void 0, void 0, Date.now(), r, n)
	}
	performUpload(r) {
		return this._apiServer.logNextEditSessionEvent(r)
	}
}