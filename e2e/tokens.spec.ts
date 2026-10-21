import { chooseFromMenu, expect, test } from "./fixtures";

test("a member creates a token in Ajustes, sees it once, uses it from a script and revokes it", async ({
  page,
  playwright,
  baseURL,
  bitacora,
}) => {
  await bitacora.open();
  await chooseFromMenu(page, "Ajustes");
  const settings = page.getByRole("dialog", { name: "Ajustes" });
  await settings.getByLabel("Nombre del token").fill("cicat");
  await settings.getByRole("button", { name: "Crear token" }).click();

  const shown = settings.getByLabel("Token nuevo");
  const token = await shown.inputValue();
  expect(token).toMatch(/^bit_[\w-]{43}$/);
  const tokens = settings.getByRole("list", { name: "Tokens" });
  await expect(tokens.getByRole("listitem")).toContainText(["cicat"]);
  await expect(tokens).toContainText("Sin usar");
  await expect(tokens).not.toContainText(token);

  // A script has no browser session.
  const script = await playwright.request.newContext({ baseURL: baseURL! });
  const created = await script.post("/api/v1/cards", {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Desde un script", list: "hecho" },
  });
  expect(created.status()).toBe(201);
  expect((await bitacora.board()).cards.map((card) => card.title)).toEqual(["Desde un script"]);

  await page.keyboard.press("Escape");
  await chooseFromMenu(page, "Ajustes");
  await expect(settings.getByLabel("Token nuevo")).toHaveCount(0);
  await expect(tokens).not.toContainText("Sin usar");
  await expect(tokens).toContainText("Último uso");

  await settings.getByRole("button", { name: "Revocar cicat" }).click();
  await expect(tokens.getByRole("listitem")).toHaveCount(0);
  const refused = await script.get("/api/v1/cards", { headers: { Authorization: `Bearer ${token}` } });
  expect(refused.status()).toBe(401);
  await script.dispose();
});
