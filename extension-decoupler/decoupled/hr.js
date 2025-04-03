
var hR = x((pTt, nge) => {
	"use strict"
	nge.exports = si
	function Xhe(e) {
		var t = this
		;(this.next = null),
			(this.entry = null),
			(this.finish = function () {
				fot(t, e)
			})
	}
	var ay
	si.WritableState = jb
	var Ost = { deprecate: dhe() },
		ege = V3(),
		pR = require("buffer").Buffer,
		qst =
			(typeof global < "u" ? global : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array ||
			function () {}
	function Vst(e) {
		return pR.from(e)
	}
	function Hst(e) {
		return pR.isBuffer(e) || e instanceof qst
	}
	var gH = W3(),
		Wst = G3(),
		Gst = Wst.getHighWaterMark,
		Bh = _h().codes,
		$st = Bh.ERR_INVALID_ARG_TYPE,
		Yst = Bh.ERR_METHOD_NOT_IMPLEMENTED,
		Kst = Bh.ERR_MULTIPLE_CALLBACK,
		Jst = Bh.ERR_STREAM_CANNOT_PIPE,
		zst = Bh.ERR_STREAM_DESTROYED,
		jst = Bh.ERR_STREAM_NULL_VALUES,
		Zst = Bh.ERR_STREAM_WRITE_AFTER_END,
		Xst = Bh.ERR_UNKNOWN_ENCODING,
		ly = gH.errorOrDestroy
	iy()(si, ege)
	function eot() {}
	function jb(e, t, r) {
		;(ay = ay || qp()),
			(e = e || {}),
			typeof r != "boolean" && (r = t instanceof ay),
			(this.objectMode = !!e.objectMode),
			r && (this.objectMode = this.objectMode || !!e.writableObjectMode),
			(this.highWaterMark = Gst(this, e, "writableHighWaterMark", r)),
			(this.finalCalled = !1),
			(this.needDrain = !1),
			(this.ending = !1),
			(this.ended = !1),
			(this.finished = !1),
			(this.destroyed = !1)
		var n = e.decodeStrings === !1
		;(this.decodeStrings = !n),
			(this.defaultEncoding = e.defaultEncoding || "utf8"),
			(this.length = 0),
			(this.writing = !1),
			(this.corked = 0),
			(this.sync = !0),
			(this.bufferProcessing = !1),
			(this.onwrite = function (i) {
				aot(t, i)
			}),
			(this.writecb = null),
			(this.writelen = 0),
			(this.bufferedRequest = null),
			(this.lastBufferedRequest = null),
			(this.pendingcb = 0),
			(this.prefinished = !1),
			(this.errorEmitted = !1),
			(this.emitClose = e.emitClose !== !1),
			(this.autoDestroy = !!e.autoDestroy),
			(this.bufferedRequestCount = 0),
			(this.corkedRequestsFree = new Xhe(this))
	}
	jb.prototype.getBuffer = function () {
		for (var t = this.bufferedRequest, r = []; t; ) r.push(t), (t = t.next)
		return r
	}
	;(function () {
		try {
			Object.defineProperty(jb.prototype, "buffer", {
				get: Ost.deprecate(
					function () {
						return this.getBuffer()
					},
					"_writableState.buffer is deprecated. Use _writableState.getBuffer instead.",
					"DEP0003",
				),
			})
		} catch {}
	})()
	var gR
	typeof Symbol == "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] == "function"
		? ((gR = Function.prototype[Symbol.hasInstance]),
			Object.defineProperty(si, Symbol.hasInstance, {
				value: function (t) {
					return gR.call(this, t) ? !0 : this !== si ? !1 : t && t._writableState instanceof jb
				},
			}))
		: (gR = function (t) {
				return t instanceof this
			})
	function si(e) {
		ay = ay || qp()
		var t = this instanceof ay
		if (!t && !gR.call(si, this)) return new si(e)
		;(this._writableState = new jb(e, this, t)),
			(this.writable = !0),
			e &&
				(typeof e.write == "function" && (this._write = e.write),
				typeof e.writev == "function" && (this._writev = e.writev),
				typeof e.destroy == "function" && (this._destroy = e.destroy),
				typeof e.final == "function" && (this._final = e.final)),
			ege.call(this)
	}
	si.prototype.pipe = function () {
		ly(this, new Jst())
	}
	function tot(e, t) {
		var r = new Zst()
		ly(e, r), process.nextTick(t, r)
	}
	function rot(e, t, r, n) {
		var i
		return (
			r === null
				? (i = new jst())
				: typeof r != "string" && !t.objectMode && (i = new $st("chunk", ["string", "Buffer"], r)),
			i ? (ly(e, i), process.nextTick(n, i), !1) : !0
		)
	}
	si.prototype.write = function (e, t, r) {
		var n = this._writableState,
			i = !1,
			s = !n.objectMode && Hst(e)
		return (
			s && !pR.isBuffer(e) && (e = Vst(e)),
			typeof t == "function" && ((r = t), (t = null)),
			s ? (t = "buffer") : t || (t = n.defaultEncoding),
			typeof r != "function" && (r = eot),
			n.ending ? tot(this, r) : (s || rot(this, n, e, r)) && (n.pendingcb++, (i = iot(this, n, s, e, t, r))),
			i
		)
	}
	si.prototype.cork = function () {
		this._writableState.corked++
	}
	si.prototype.uncork = function () {
		var e = this._writableState
		e.corked && (e.corked--, !e.writing && !e.corked && !e.bufferProcessing && e.bufferedRequest && tge(this, e))
	}
	si.prototype.setDefaultEncoding = function (t) {
		if (
			(typeof t == "string" && (t = t.toLowerCase()),
			!(
				[
					"hex",
					"utf8",
					"utf-8",
					"ascii",
					"binary",
					"base64",
					"ucs2",
					"ucs-2",
					"utf16le",
					"utf-16le",
					"raw",
				].indexOf((t + "").toLowerCase()) > -1
			))
		)
			throw new Xst(t)
		return (this._writableState.defaultEncoding = t), this
	}
	Object.defineProperty(si.prototype, "writableBuffer", {
		enumerable: !1,
		get: function () {
			return this._writableState && this._writableState.getBuffer()
		},
	})
	function not(e, t, r) {
		return !e.objectMode && e.decodeStrings !== !1 && typeof t == "string" && (t = pR.from(t, r)), t
	}
	Object.defineProperty(si.prototype, "writableHighWaterMark", {
		enumerable: !1,
		get: function () {
			return this._writableState.highWaterMark
		},
	})
	function iot(e, t, r, n, i, s) {
		if (!r) {
			var o = not(t, n, i)
			n !== o && ((r = !0), (i = "buffer"), (n = o))
		}
		var a = t.objectMode ? 1 : n.length
		t.length += a
		var l = t.length < t.highWaterMark
		if ((l || (t.needDrain = !0), t.writing || t.corked)) {
			var c = t.lastBufferedRequest
			;(t.lastBufferedRequest = {
				chunk: n,
				encoding: i,
				isBuf: r,
				callback: s,
				next: null,
			}),
				c ? (c.next = t.lastBufferedRequest) : (t.bufferedRequest = t.lastBufferedRequest),
				(t.bufferedRequestCount += 1)
		} else hH(e, t, !1, a, n, i, s)
		return l
	}
	function hH(e, t, r, n, i, s, o) {
		;(t.writelen = n),
			(t.writecb = o),
			(t.writing = !0),
			(t.sync = !0),
			t.destroyed ? t.onwrite(new zst("write")) : r ? e._writev(i, t.onwrite) : e._write(i, s, t.onwrite),
			(t.sync = !1)
	}
	function sot(e, t, r, n, i) {
		--t.pendingcb,
			r
				? (process.nextTick(i, n), process.nextTick(zb, e, t), (e._writableState.errorEmitted = !0), ly(e, n))
				: (i(n), (e._writableState.errorEmitted = !0), ly(e, n), zb(e, t))
	}
	function oot(e) {
		;(e.writing = !1), (e.writecb = null), (e.length -= e.writelen), (e.writelen = 0)
	}
	function aot(e, t) {
		var r = e._writableState,
			n = r.sync,
			i = r.writecb
		if (typeof i != "function") throw new Kst()
		if ((oot(r), t)) sot(e, r, n, t, i)
		else {
			var s = rge(r) || e.destroyed
			!s && !r.corked && !r.bufferProcessing && r.bufferedRequest && tge(e, r),
				n ? process.nextTick(Zhe, e, r, s, i) : Zhe(e, r, s, i)
		}
	}
	function Zhe(e, t, r, n) {
		r || lot(e, t), t.pendingcb--, n(), zb(e, t)
	}
	function lot(e, t) {
		t.length === 0 && t.needDrain && ((t.needDrain = !1), e.emit("drain"))
	}
	function tge(e, t) {
		t.bufferProcessing = !0
		var r = t.bufferedRequest
		if (e._writev && r && r.next) {
			var n = t.bufferedRequestCount,
				i = new Array(n),
				s = t.corkedRequestsFree
			s.entry = r
			for (var o = 0, a = !0; r; ) (i[o] = r), r.isBuf || (a = !1), (r = r.next), (o += 1)
			;(i.allBuffers = a),
				hH(e, t, !0, t.length, i, "", s.finish),
				t.pendingcb++,
				(t.lastBufferedRequest = null),
				s.next ? ((t.corkedRequestsFree = s.next), (s.next = null)) : (t.corkedRequestsFree = new Xhe(t)),
				(t.bufferedRequestCount = 0)
		} else {
			for (; r; ) {
				var l = r.chunk,
					c = r.encoding,
					u = r.callback,
					f = t.objectMode ? 1 : l.length
				if ((hH(e, t, !1, f, l, c, u), (r = r.next), t.bufferedRequestCount--, t.writing)) break
			}
			r === null && (t.lastBufferedRequest = null)
		}
		;(t.bufferedRequest = r), (t.bufferProcessing = !1)
	}
	si.prototype._write = function (e, t, r) {
		r(new Yst("_write()"))
	}
	si.prototype._writev = null
	si.prototype.end = function (e, t, r) {
		var n = this._writableState
		return (
			typeof e == "function"
				? ((r = e), (e = null), (t = null))
				: typeof t == "function" && ((r = t), (t = null)),
			e != null && this.write(e, t),
			n.corked && ((n.corked = 1), this.uncork()),
			n.ending || dot(this, n, r),
			this
		)
	}
	Object.defineProperty(si.prototype, "writableLength", {
		enumerable: !1,
		get: function () {
			return this._writableState.length
		},
	})
	function rge(e) {
		return e.ending && e.length === 0 && e.bufferedRequest === null && !e.finished && !e.writing
	}
	function cot(e, t) {
		e._final(function (r) {
			t.pendingcb--, r && ly(e, r), (t.prefinished = !0), e.emit("prefinish"), zb(e, t)
		})
	}
	function uot(e, t) {
		!t.prefinished &&
			!t.finalCalled &&
			(typeof e._final == "function" && !t.destroyed
				? (t.pendingcb++, (t.finalCalled = !0), process.nextTick(cot, e, t))
				: ((t.prefinished = !0), e.emit("prefinish")))
	}
	function zb(e, t) {
		var r = rge(t)
		if (r && (uot(e, t), t.pendingcb === 0 && ((t.finished = !0), e.emit("finish"), t.autoDestroy))) {
			var n = e._readableState
			;(!n || (n.autoDestroy && n.endEmitted)) && e.destroy()
		}
		return r
	}
	function dot(e, t, r) {
		;(t.ending = !0),
			zb(e, t),
			r && (t.finished ? process.nextTick(r) : e.once("finish", r)),
			(t.ended = !0),
			(e.writable = !1)
	}
	function fot(e, t, r) {
		var n = e.entry
		for (e.entry = null; n; ) {
			var i = n.callback
			t.pendingcb--, i(r), (n = n.next)
		}
		t.corkedRequestsFree.next = e
	}
	Object.defineProperty(si.prototype, "destroyed", {
		enumerable: !1,
		get: function () {
			return this._writableState === void 0 ? !1 : this._writableState.destroyed
		},
		set: function (t) {
			this._writableState && (this._writableState.destroyed = t)
		},
	})
	si.prototype.destroy = gH.destroy
	si.prototype._undestroy = gH.undestroy
	si.prototype._destroy = function (e, t) {
		t(e)
	}
})