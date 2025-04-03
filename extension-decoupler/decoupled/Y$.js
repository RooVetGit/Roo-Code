
function y$(e) {
	return typeof e != "string"
		? { isValid: !1, reason: "Shard ID must be a string" }
		: e.length === 0
			? { isValid: !1, reason: "Shard ID cannot be empty" }
			: { isValid: !0 }
}