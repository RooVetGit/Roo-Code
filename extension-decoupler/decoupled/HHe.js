
	function Hhe(e, t, r) {
		;(sy = sy || qp()),
			(e = e || {}),
			typeof r != "boolean" && (r = t instanceof sy),
			(this.objectMode = !!e.objectMode),
			r && (this.objectMode = this.objectMode || !!e.readableObjectMode),
			(this.highWaterMark = bst(this, e, "readableHighWaterMark", r)),
			(this.buffer = new vst()),
			(this.length = 0),
			(this.pipes = null),
			(this.pipesCount = 0),
			(this.flowing = null),
			(this.ended = !1),
			(this.endEmitted = !1),
			(this.reading = !1),
			(this.sync = !0),
			(this.needReadable = !1),
			(this.emittedReadable = !1),
			(this.readableListening = !1),
			(this.resumeScheduled = !1),
			(this.paused = !0),
			(this.emitClose = e.emitClose !== !1),
			(this.autoDestroy = !!e.autoDestroy),
			(this.destroyed = !1),
			(this.defaultEncoding = e.defaultEncoding || "utf8"),
			(this.awaitDrain = 0),
			(this.readingMore = !1),
			(this.decoder = null),
			(this.encoding = null),
			e.encoding &&
				(oy || (oy = X3().StringDecoder), (this.decoder = new oy(e.encoding)), (this.encoding = e.encoding))
	}