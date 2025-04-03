
	function Rje(e, t) {
		;(t = t || {}), (this.read = t.readOffset || 0), (this.growSize = t.growSize || 1024)
		var r = $.isArrayBuffer(e),
			n = $.isArrayBufferView(e)
		if (r || n) {
			r ? (this.data = new DataView(e)) : (this.data = new DataView(e.buffer, e.byteOffset, e.byteLength)),
				(this.write = "writeOffset" in t ? t.writeOffset : this.data.byteLength)
			return
		}
		;(this.data = new DataView(new ArrayBuffer(0))),
			(this.write = 0),
			e != null && this.putBytes(e),
			"writeOffset" in t && (this.write = t.writeOffset)
	}