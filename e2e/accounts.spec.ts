import { chooseFromMenu, expect, test } from "./fixtures";

test("an admin invites a member, who signs up, adds a card and is never seen on the admin's board", async ({
  page,
  browser,
  bitacora,
}, testInfo) => {
  await bitacora.seed([{ title: "Del admin", list: "en_curso" }]);
  await bitacora.open();

  await chooseFromMenu(page, "Ajustes");
  const settings = page.getByRole("dialog", { name: "Ajustes" });
  const members = settings.getByRole("region", { name: "Miembros" });
  await members.getByLabel("Rol de la invitación").selectOption("member");
  await members.getByRole("button", { name: "Invitar" }).click();
  const link = await members.getByLabel("Enlace de invitación").inputValue();
  expect(link).toMatch(/\/invitacion\/[\w-]+$/);

  // The invitee is another person in another browser.
  const guest = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    locale: "es-PE",
    timezoneId: "America/Lima",
  });
  const theirs = await guest.newPage();
  const email = `ana-${Date.now()}@bitacora.test`;
  await theirs.goto(link);
  await theirs.getByLabel("Nombre").fill("Ana");
  await theirs.getByLabel("Correo").fill(email);
  await theirs.getByLabel("Contraseña").fill("una-clave-larga");
  await theirs.getByRole("button", { name: "Crear cuenta" }).click();

  // They land signed in on an empty board and add a card.
  await expect(theirs.getByRole("heading", { name: "Bitácora" })).toBeVisible();
  await expect(theirs.locator("[data-card-id]")).toHaveCount(0);
  const active = theirs.getByRole("region", { name: "En curso", exact: true });
  await active.getByRole("button", { name: "Añade una tarjeta" }).click();
  await active.getByRole("textbox", { name: "Título de la tarjeta" }).fill("De Ana");
  await theirs.keyboard.press("Enter");
  await expect(active.locator("[data-card-id]")).toHaveText(["De Ana"]);
  await expect.poll(async () => (await (await theirs.request.get("/api/board")).json()).cards.length).toBe(1);

  // The admin's board shows only their own card, also after a reload.
  await page.reload();
  await bitacora.open();
  await expect(bitacora.card("Del admin")).toBeVisible();
  await expect(page.locator("[data-card-id]")).toHaveCount(1);
  await expect(bitacora.card("De Ana")).toHaveCount(0);

  // The invitation works once.
  const second = await browser.newContext({ baseURL: testInfo.project.use.baseURL, locale: "es-PE" });
  const reused = await second.newPage();
  await reused.goto(link);
  await expect(reused.getByRole("heading", { name: "Este enlace ya no sirve" })).toBeVisible();

  // A member has no Miembros section.
  await chooseFromMenu(theirs, "Ajustes");
  const own = theirs.getByRole("dialog", { name: "Ajustes" });
  await expect(own.getByRole("heading", { name: "Cuenta" })).toBeVisible();
  await expect(own.getByRole("region", { name: "Miembros" })).toHaveCount(0);

  await guest.close();
  await second.close();
});
