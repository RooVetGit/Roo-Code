
var Pj = x((wxt, Nj) => {
	"use strict"
	var NLe = bS(),
		PLe = KL()
	Nj.exports = lU
	function lU(e, t) {
		;(this._window = e), (this._href = t)
	}
	lU.prototype = Object.create(PLe.prototype, {
		constructor: { value: lU },
		href: {
			get: function () {
				return this._href
			},
			set: function (e) {
				this.assign(e)
			},
		},
		assign: {
			value: function (e) {
				var t = new NLe(this._href),
					r = t.resolve(e)
				this._href = r
			},
		},
		replace: {
			value: function (e) {
				this.assign(e)
			},
		},
		reload: {
			value: function () {
				this.assign(this.href)
			},
		},
		toString: {
			value: function () {
				return this.href
			},
		},
	})
})