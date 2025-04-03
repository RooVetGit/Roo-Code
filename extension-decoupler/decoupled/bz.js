
var Bz = x((uxt, Sz) => {
	"use strict"
	Sz.exports = Iz
	var WL = iE(),
		GL = qL(),
		wz = ei()
	function QPe(e, t, r) {
		return r ? GL.next(e, t) : e === t ? null : GL.previous(e, null)
	}
	function xz(e, t) {
		for (; t; t = t.parentNode) if (e === t) return !0
		return !1
	}
	function _z(e, t) {
		var r, n
		for (r = e._referenceNode, n = e._pointerBeforeReferenceNode; ; ) {
			if (n === t) n = !n
			else if (((r = QPe(r, e._root, t)), r === null)) return null
			var i = e._internalFilter(r)
			if (i === WL.FILTER_ACCEPT) break
		}
		return (e._referenceNode = r), (e._pointerBeforeReferenceNode = n), r
	}
	function Iz(e, t, r) {
		;(!e || !e.nodeType) && wz.NotSupportedError(),
			(this._root = e),
			(this._referenceNode = e),
			(this._pointerBeforeReferenceNode = !0),
			(this._whatToShow = Number(t) || 0),
			(this._filter = r || null),
			(this._active = !1),
			e.doc._attachNodeIterator(this)
	}
	Object.defineProperties(Iz.prototype, {
		root: {
			get: function () {
				return this._root
			},
		},
		referenceNode: {
			get: function () {
				return this._referenceNode
			},
		},
		pointerBeforeReferenceNode: {
			get: function () {
				return this._pointerBeforeReferenceNode
			},
		},
		whatToShow: {
			get: function () {
				return this._whatToShow
			},
		},
		filter: {
			get: function () {
				return this._filter
			},
		},
		_internalFilter: {
			value: function (t) {
				var r, n
				if ((this._active && wz.InvalidStateError(), !((1 << (t.nodeType - 1)) & this._whatToShow)))
					return WL.FILTER_SKIP
				if (((n = this._filter), n === null)) r = WL.FILTER_ACCEPT
				else {
					this._active = !0
					try {
						typeof n == "function" ? (r = n(t)) : (r = n.acceptNode(t))
					} finally {
						this._active = !1
					}
				}
				return +r
			},
		},
		_preremove: {
			value: function (t) {
				if (!xz(t, this._root) && xz(t, this._referenceNode)) {
					if (this._pointerBeforeReferenceNode) {
						for (var r = t; r.lastChild; ) r = r.lastChild
						if (((r = GL.next(r, this.root)), r)) {
							this._referenceNode = r
							return
						}
						this._pointerBeforeReferenceNode = !1
					}
					if (t.previousSibling === null) this._referenceNode = t.parentNode
					else {
						this._referenceNode = t.previousSibling
						var n
						for (n = this._referenceNode.lastChild; n; n = this._referenceNode.lastChild)
							this._referenceNode = n
					}
				}
			},
		},
		nextNode: {
			value: function () {
				return _z(this, !0)
			},
		},
		previousNode: {
			value: function () {
				return _z(this, !1)
			},
		},
		detach: { value: function () {} },
		toString: {
			value: function () {
				return "[object NodeIterator]"
			},
		},
	})
})