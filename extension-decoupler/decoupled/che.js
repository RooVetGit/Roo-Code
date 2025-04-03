
var Che = x((sTt, $3) => {
	"use strict"
	typeof Object.create == "function"
		? ($3.exports = function (t, r) {
				r &&
					((t.super_ = r),
					(t.prototype = Object.create(r.prototype, {
						constructor: {
							value: t,
							enumerable: !1,
							writable: !0,
							configurable: !0,
						},
					})))
			})
		: ($3.exports = function (t, r) {
				if (r) {
					t.super_ = r
					var n = function () {}
					;(n.prototype = r.prototype), (t.prototype = new n()), (t.prototype.constructor = t)
				}
			})
})