// A Vite asset imported for its served URL (`import url from "./x?url"`).
declare module "*?url" {
  const url: string;
  export default url;
}
