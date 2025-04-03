
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