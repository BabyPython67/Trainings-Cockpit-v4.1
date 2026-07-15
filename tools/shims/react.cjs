// Stub: nur was auf Modulebene der Quelldatei angefasst wird — Komponenten werden in den Pure-Tests nie gerendert
const stub = () => {};
const React = {
  createContext: (v) => ({ Provider: stub, Consumer: stub, _default: v }),
  useContext: () => false,
  useState: (v) => [typeof v === "function" ? v() : v, stub],
  useEffect: stub,
  useMemo: (f) => f(),
  useRef: (v) => ({ current: v }),
  useCallback: (f) => f,
  createElement: () => null,
  Fragment: "Fragment",
};
module.exports = React;
