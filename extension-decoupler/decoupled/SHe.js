
var she = x((JDt, ihe) => {
	"use strict"
	var mit = nhe(),
		yit = Go()
	ihe.exports = yit(
		(e, t = {}) => (
			t.format && (e.timestamp = typeof t.format == "function" ? t.format() : mit.format(new Date(), t.format)),
			e.timestamp || (e.timestamp = new Date().toISOString()),
			t.alias && (e[t.alias] = e.timestamp),
			e
		),
	)
})