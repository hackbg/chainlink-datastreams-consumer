export function defineProperty (object, name, get, set) {
  Object.defineProperty(object, name, { enumerable: true, configurable: true, get, set })
}

export function defineHiddenProperty (object, name, get, set) {
  Object.defineProperty(object, name, { enumerable: false, configurable: true, get, set })
}

export function compareSets (xs, ys) {
  return xs.size === ys.size && [...xs].every((x) => ys.has(x));
}

export function makeSetReadOnly (set, readOnly) {
  return Object.assign(set, { add: readOnly, delete: readOnly, clear: readOnly });
}
