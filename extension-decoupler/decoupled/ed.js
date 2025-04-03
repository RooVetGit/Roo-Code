
	var Ed = ei(),
		Za = (XK.exports = {
			valid: function (e) {
				return (
					Ed.assert(e, "list falsy"),
					Ed.assert(e._previousSibling, "previous falsy"),
					Ed.assert(e._nextSibling, "next falsy"),
					!0
				)
			},
			insertBefore: function (e, t) {
				Ed.assert(Za.valid(e) && Za.valid(t))
				var r = e,
					n = e._previousSibling,
					i = t,
					s = t._previousSibling
				;(r._previousSibling = s),
					(n._nextSibling = i),
					(s._nextSibling = r),
					(i._previousSibling = n),
					Ed.assert(Za.valid(e) && Za.valid(t))
			},
			replace: function (e, t) {
				Ed.assert(Za.valid(e) && (t === null || Za.valid(t))),
					t !== null && Za.insertBefore(t, e),
					Za.remove(e),
					Ed.assert(Za.valid(e) && (t === null || Za.valid(t)))
			},
			remove: function (e) {
				Ed.assert(Za.valid(e))
				var t = e._previousSibling
				if (t !== e) {
					var r = e._nextSibling
					;(t._nextSibling = r),
						(r._previousSibling = t),
						(e._previousSibling = e._nextSibling = e),
						Ed.assert(Za.valid(e))
				}
			},
		})