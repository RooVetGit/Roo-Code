
function Egt(e) {
	return e === 0 ? !1 : { level: e, hasBasic: !0, has256: e >= 2, has16m: e >= 3 }
}