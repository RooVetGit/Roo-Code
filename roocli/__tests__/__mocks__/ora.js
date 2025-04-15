/**
 * Mock implementation of ora
 */
const ora = jest.fn(() => {
	return {
		start: jest.fn().mockReturnThis(),
		stop: jest.fn().mockReturnThis(),
		succeed: jest.fn().mockReturnThis(),
		fail: jest.fn().mockReturnThis(),
		warn: jest.fn().mockReturnThis(),
		info: jest.fn().mockReturnThis(),
		text: "",
		color: "white",
		isSpinning: false,
		clear: jest.fn().mockReturnThis(),
		render: jest.fn().mockReturnThis(),
		frame: jest.fn().mockReturnThis(),
	}
})

module.exports = ora
