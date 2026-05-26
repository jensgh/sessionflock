// electron-vite copies files imported with the `?asset` suffix to the build
// output and resolves the import to their runtime path (string).
declare module '*?asset' {
  const assetPath: string
  export default assetPath
}
