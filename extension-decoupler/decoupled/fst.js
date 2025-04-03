
	function Fst(e, t) {
		t.resumeScheduled || ((t.resumeScheduled = !0), process.nextTick(Qst, e, t))
	}