/** @jsxImportSource hono/jsx */
import { raw } from "hono/html";
import tokens from "../../web/styles/tokens.css?raw";

// These pages use the app's tokens and follow the system theme. They do not
// read a stored choice.
const BASE_CSS = `
* { box-sizing: border-box; margin: 0; }
body {
  min-height: 100dvh;
  font-size: var(--text-sm);
  line-height: var(--leading);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  color: var(--text);
  background: var(--board);
}
strong, b { font-weight: var(--weight-strong); }
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
`;

export function Document(props: { title: string; css: string; children: unknown }) {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="color-scheme" content="light dark" />
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossorigin="anonymous"
        />
        <title>{props.title}</title>
        <style>{raw(tokens + BASE_CSS + props.css)}</style>
      </head>
      <body>{props.children}</body>
    </html>
  );
}
