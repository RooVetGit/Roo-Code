
var upe = x((BTt, cpe) => {
	"use strict"
	cpe.exports = function (t) {
		return !t || typeof t == "string"
			? !1
			: t instanceof Array ||
					Array.isArray(t) ||
					(t.length >= 0 &&
						(t.splice instanceof Function ||
							(Object.getOwnPropertyDescriptor(t, t.length - 1) && t.constructor.name !== "String")))
	}
})