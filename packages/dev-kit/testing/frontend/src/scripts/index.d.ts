declare module '*.vue';

declare module '*.jpg' {
  const value: string;
  export default value;
}
declare module '*.svg' {
  const value: string;
  export default value;
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
