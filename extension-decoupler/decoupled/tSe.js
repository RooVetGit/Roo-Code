
	function Tse(e) {
		return t
		function t() {
			let r = e.deref()
			if (r !== void 0) {
				Fse.unregister(t), this.removeEventListener("abort", t), r.abort(this.reason)
				let n = xD.get(r.signal)
				if (n !== void 0) {
					if (n.size !== 0) {
						for (let i of n) {
							let s = i.deref()
							s !== void 0 && s.abort(this.reason)
						}
						n.clear()
					}
					xD.delete(r.signal)
				}
			}
		}
	}