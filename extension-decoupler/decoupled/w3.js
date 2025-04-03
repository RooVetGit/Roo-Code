
var W3 = x((rTt, ghe) => {
	"use strict"
	function bit(e, t) {
		var r = this,
			n = this._readableState && this._readableState.destroyed,
			i = this._writableState && this._writableState.destroyed
		return n || i
			? (t
					? t(e)
					: e &&
						(this._writableState
							? this._writableState.errorEmitted ||
								((this._writableState.errorEmitted = !0), process.nextTick(H3, this, e))
							: process.nextTick(H3, this, e)),
				this)
			: (this._readableState && (this._readableState.destroyed = !0),
				this._writableState && (this._writableState.destroyed = !0),
				this._destroy(e || null, function (s) {
					!t && s
						? r._writableState
							? r._writableState.errorEmitted
								? process.nextTick(rR, r)
								: ((r._writableState.errorEmitted = !0), process.nextTick(hhe, r, s))
							: process.nextTick(hhe, r, s)
						: t
							? (process.nextTick(rR, r), t(s))
							: process.nextTick(rR, r)
				}),
				this)
	}
	function hhe(e, t) {
		H3(e, t), rR(e)
	}
	function rR(e) {
		;(e._writableState && !e._writableState.emitClose) ||
			(e._readableState && !e._readableState.emitClose) ||
			e.emit("close")
	}
	function xit() {
		this._readableState &&
			((this._readableState.destroyed = !1),
			(this._readableState.reading = !1),
			(this._readableState.ended = !1),
			(this._readableState.endEmitted = !1)),
			this._writableState &&
				((this._writableState.destroyed = !1),
				(this._writableState.ended = !1),
				(this._writableState.ending = !1),
				(this._writableState.finalCalled = !1),
				(this._writableState.prefinished = !1),
				(this._writableState.finished = !1),
				(this._writableState.errorEmitted = !1))
	}
	function H3(e, t) {
		e.emit("error", t)
	}
	function _it(e, t) {
		var r = e._readableState,
			n = e._writableState
		;(r && r.autoDestroy) || (n && n.autoDestroy) ? e.destroy(t) : e.emit("error", t)
	}
	ghe.exports = { destroy: bit, undestroy: xit, errorOrDestroy: _it }
})