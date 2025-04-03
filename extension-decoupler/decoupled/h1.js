
var H1 = class e extends Zn {
	constructor(r, n, i, s, o) {
		super(
			"CompletionAcceptanceReporter",
			i ?? e.defaultMaxRecords,
			s ?? e.defaultUploadMsec,
			o ?? e.defaultBatchSize,
		)
		this._apiServer = r
		this._onboardingSessionEventReporter = n
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportResolution(r, n, i, s) {
		let [o, a] = kn(n),
			[l, c] = kn(i)
		this.report({
			request_id: r,
			emit_time_sec: o,
			emit_time_nsec: a,
			resolve_time_sec: l,
			resolve_time_nsec: c,
			accepted_idx: s ?? -1,
		}),
			s !== void 0 && this._onboardingSessionEventReporter.reportEvent("accepted-completion")
	}
	performUpload(r) {
		return this._apiServer.resolveCompletions(r)
	}
}