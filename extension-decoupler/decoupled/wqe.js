
function WQe(e) {
	var t
	return 48 <= e && e <= 57 ? e - 48 : ((t = e | 32), 97 <= t && t <= 102 ? t - 97 + 10 : -1)
}