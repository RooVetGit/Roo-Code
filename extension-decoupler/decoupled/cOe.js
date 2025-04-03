
var Coe = x((hSt, yoe) => {
	"use strict"
	var MKe = require("assert"),
		{ URLSerializer: moe } = No(),
		{ isValidHeaderName: FKe } = ga()
	function QKe(e, t, r = !1) {
		let n = moe(e, r),
			i = moe(t, r)
		return n === i
	}
	function NKe(e) {
		MKe(e !== null)
		let t = []
		for (let r of e.split(",")) (r = r.trim()), FKe(r) && t.push(r)
		return t
	}
	yoe.exports = { urlEquals: QKe, getFieldValues: NKe }
})