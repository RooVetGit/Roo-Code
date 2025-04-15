/**
 * Mock implementation of chalk
 */
const chalk = {
	red: jest.fn((text) => text),
	green: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	magenta: jest.fn((text) => text),
	cyan: jest.fn((text) => text),
	white: jest.fn((text) => text),
	gray: jest.fn((text) => text),
	grey: jest.fn((text) => text),
	black: jest.fn((text) => text),
	bold: jest.fn((text) => text),
	dim: jest.fn((text) => text),
	italic: jest.fn((text) => text),
	underline: jest.fn((text) => text),
	inverse: jest.fn((text) => text),
	hidden: jest.fn((text) => text),
	strikethrough: jest.fn((text) => text),
	visible: jest.fn((text) => text),
	reset: jest.fn((text) => text),
	bgRed: jest.fn((text) => text),
	bgGreen: jest.fn((text) => text),
	bgYellow: jest.fn((text) => text),
	bgBlue: jest.fn((text) => text),
	bgMagenta: jest.fn((text) => text),
	bgCyan: jest.fn((text) => text),
	bgWhite: jest.fn((text) => text),
	bgBlack: jest.fn((text) => text),
	bgGray: jest.fn((text) => text),
	bgGrey: jest.fn((text) => text),
}

// Add chaining support
Object.keys(chalk).forEach((key) => {
	chalk[key].bold = jest.fn((text) => text)
	chalk[key].dim = jest.fn((text) => text)
	chalk[key].italic = jest.fn((text) => text)
	chalk[key].underline = jest.fn((text) => text)
	chalk[key].inverse = jest.fn((text) => text)
	chalk[key].hidden = jest.fn((text) => text)
	chalk[key].strikethrough = jest.fn((text) => text)
	chalk[key].visible = jest.fn((text) => text)
	chalk[key].reset = jest.fn((text) => text)
})

module.exports = chalk
