
	function IV(e) {
		if (e.internalResponse) return mse(IV(e.internalResponse), e.type)
		let t = _0({ ...e, body: null })
		return e.body != null && (t.body = U$e(t, e.body)), t
	}