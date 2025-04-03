
	function VGe(e) {
		let t = this[oc] || new LE(`HTTP/2: "GOAWAY" frame received with code ${e}`, dr.getSocketInfo(this)),
			r = this[c0]
		if (
			((r[zi] = null),
			(r[BGe] = null),
			this[sc] != null && (this[sc].destroy(t), (this[sc] = null)),
			dr.destroy(this[zi], t),
			r[ic] < r[Kf].length)
		) {
			let n = r[Kf][r[ic]]
			;(r[Kf][r[ic]++] = null), dr.errorRequest(r, n, t), (r[iq] = r[ic])
		}
		il(r[VB] === 0), r.emit("disconnect", r[UB], [r], t), r[Jf]()
	}