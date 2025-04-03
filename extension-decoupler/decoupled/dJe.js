
	function Dje(e, t) {
		var r = 0,
			n = t.length,
			i = t.charAt(0),
			s = [0]
		for (r = 0; r < e.length(); ++r) {
			for (var o = 0, a = e.at(r); o < s.length; ++o) (a += s[o] << 8), (s[o] = a % n), (a = (a / n) | 0)
			for (; a > 0; ) s.push(a % n), (a = (a / n) | 0)
		}
		var l = ""
		for (r = 0; e.at(r) === 0 && r < e.length() - 1; ++r) l += i
		for (r = s.length - 1; r >= 0; --r) l += t[s[r]]
		return l
	}