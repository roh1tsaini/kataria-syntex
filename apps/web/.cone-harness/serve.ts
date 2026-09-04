Bun.serve({
  port: 4173,
  fetch: () =>
    new Response(Bun.file(new URL("./out.html", import.meta.url)), {
      headers: { "content-type": "text/html" },
    }),
});
console.log("serving");
