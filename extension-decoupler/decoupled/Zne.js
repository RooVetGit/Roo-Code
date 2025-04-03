
function ZNe(e, t, r = 100) {
	let n = e.length,
		i = t.length,
		s = Array.from({ length: n }).fill(-1)
	if (n === 0 || i === 0) return s
	let o = Array.from({ length: n + 1 })
			.fill([])
			.map(() => Array.from({ length: 2 * r + 1 }).fill(0)),
		a = Array.from({ length: n + 1 })
			.fill([])
			.map(() => Array.from({ length: 2 * r + 1 }).fill([0, 0]))
	for (let m = 1; m <= n; m++) {
		let y = Math.max(1, m - r),
			C = Math.min(i, m + r)
		for (let v = y; v <= C; v++) {
			let b = v - (m - r)
			if (e[m - 1] === t[v - 1]) {
				let w = m - 1,
					B = v - 1
				if (B >= Math.max(1, w - r) && B <= Math.min(i, w + r)) {
					let M = B - (w - r)
					;(o[m][b] = o[w][M] + 1), (a[m][b] = [-1, -1])
				} else (o[m][b] = 1), (a[m][b] = [-1, -1])
			} else {
				let w = 0,
					B = 0
				v - 1 >= y && (w = o[m][b - 1])
				let M = m - 1
				if (v >= Math.max(1, M - r) && v <= Math.min(i, M + r)) {
					let Q = v - (M - r)
					B = o[M][Q]
				}
				w >= B ? ((o[m][b] = w), (a[m][b] = [0, -1])) : ((o[m][b] = B), (a[m][b] = [-1, 0]))
			}
		}
	}
	let l = n,
		c = i,
		u = 0,
		f = i,
		p = Math.max(1, n - r),
		g = Math.min(i, n + r)
	for (let m = p; m <= g; m++) {
		let y = m - (n - r)
		o[n][y] > u && ((u = o[n][y]), (f = m))
	}
	for (l = n, c = f; l > 0 && c > 0; ) {
		let m = c - (l - r)
		if (m < 0 || m >= 2 * r + 1) break
		let [y, C] = a[l][m]
		if ((y === -1 && C === -1 && (s[l - 1] = c - 1), (l += y), (c += C), y === 0 && C === 0)) break
	}
	return s
}