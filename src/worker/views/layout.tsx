/** @jsxImportSource hono/jsx */
import { raw } from "hono/html";

const BASE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 14px/20px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, "Helvetica Neue", sans-serif;
  color: rgb(41 42 46);
  background: rgb(241 242 244);
}
`;

export function Document(props: { title: string; css: string; children: unknown }) {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{props.title}</title>
        <style>{raw(BASE_CSS + props.css)}</style>
      </head>
      <body>{props.children}</body>
    </html>
  );
}
