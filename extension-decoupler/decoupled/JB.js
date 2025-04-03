
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