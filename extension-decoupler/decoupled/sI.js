
function SI(e, t, r, n) {
	if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter")
	if (typeof t == "function" ? e !== t || !n : !t.has(e))
		throw new TypeError("Cannot read private member from an object whose class did not declare it")
	return r === "m" ? n : r === "a" ? n.call(e) : n ? n.value : t.get(e)
}