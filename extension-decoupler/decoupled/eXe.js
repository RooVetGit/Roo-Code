
function Exe(e, t) {
	let r = L0t(e, t),
		n = [],
		i = e.length,
		s = t.length
	for (let o = r; o !== null; o = o.chain) {
		let a = i - o.buffer1index - 1,
			l = s - o.buffer2index - 1
		;(i = o.buffer1index),
			(s = o.buffer2index),
			(a || l) &&
				n.push({
					buffer1: [i + 1, a],
					buffer1Content: e.slice(i + 1, i + 1 + a),
					buffer2: [s + 1, l],
					buffer2Content: t.slice(s + 1, s + 1 + l),
				})
	}
	return n.reverse(), n
}