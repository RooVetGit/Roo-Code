
var dk = class {
		tracingData = { flags: {}, nums: {}, string_stats: {}, request_ids: {} }
		setFlag(t, r = !0) {
			this.tracingData.flags[t] = {
				value: r,
				timestamp: new Date().toISOString(),
			}
		}
		setNum(t, r) {
			this.tracingData.nums[t] = {
				value: r,
				timestamp: new Date().toISOString(),
			}
		}
		setStringStats(t, r) {
			this.tracingData.string_stats[t] = {
				value: qct(r),
				timestamp: new Date().toISOString(),
			}
		}
		setRequestId(t, r) {
			this.tracingData.request_ids[t] = {
				value: r,
				timestamp: new Date().toISOString(),
			}
		}
	},
	fk
;