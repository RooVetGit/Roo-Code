
var V1 = class {
	constructor(t) {
		this._apiServer = t
	}
	uploadEnabled = !1
	_logger = X("CodeEditReporter")
	enableUpload() {
		this.uploadEnabled = !0
	}
	disableUpload() {
		this.uploadEnabled = !1
	}
	dispose() {
		this.disableUpload()
	}
	async reportResolution(t, r, n, i, s) {
		let [o, a] = kn(r),
			[l, c] = kn(n),
			u = {
				request_id: t,
				emit_time_sec: o,
				emit_time_nsec: a,
				resolve_time_sec: l,
				resolve_time_nsec: c,
				is_accepted: i,
				annotated_text: s,
			}
		await xi(async () => {
			if (this.uploadEnabled)
				try {
					return await this._apiServer.logCodeEditResolution(u)
				} catch (f) {
					throw (this._logger.error(`Error reporting edit resolution: ${f}`), f)
				}
		}, this._logger)
	}
}