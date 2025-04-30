export const visit = jest.fn((tree, _nodeType, _visitor) => tree)

export const CONTINUE = Symbol("continue")
export const EXIT = Symbol("exit")
export const SKIP = Symbol("skip")
