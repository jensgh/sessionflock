// Image imports are resolved to URLs by Vite at build time. Declared here so the
// renderer TS project (types: ["node"]) knows their shape.
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
