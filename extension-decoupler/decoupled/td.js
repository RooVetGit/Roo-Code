
	var { webidl: va } = ys(),
		TD = Symbol("ProgressEvent state"),
		OV = class e extends Event {
			constructor(t, r = {}) {
				;(t = va.converters.DOMString(t, "ProgressEvent constructor", "type")),
					(r = va.converters.ProgressEventInit(r ?? {})),
					super(t, r),
					(this[TD] = {
						lengthComputable: r.lengthComputable,
						loaded: r.loaded,
						total: r.total,
					})
			}
			get lengthComputable() {
				return va.brandCheck(this, e), this[TD].lengthComputable
			}
			get loaded() {
				return va.brandCheck(this, e), this[TD].loaded
			}
			get total() {
				return va.brandCheck(this, e), this[TD].total
			}
		}