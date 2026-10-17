import type { Page } from "@playwright/test";
import { chooseFromMenu, expect, test } from "./fixtures";

/** Paints the page background into a pixel and says whether it is dark. The script runs in the page, which these tests type without DOM globals. */
const isDark = (page: Page): Promise<boolean> =>
  page.evaluate(`(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  })()`);

test.describe("themes", () => {
  test("a dark system setting paints dark before any app script runs", async ({ page, bitacora }) => {
    await bitacora.board();
    await page.emulateMedia({ colorScheme: "dark" });
    // Without the app bundle only the document, its inline script and its stylesheet remain.
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.goto("/");
    expect(await isDark(page)).toBe(true);
  });

  test("a stored choice beats the system setting before any app script runs", async ({ page, bitacora }) => {
    await bitacora.board();
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.setItem("bitacora.theme", "dark"));
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.goto("/");
    expect(await isDark(page)).toBe(true);
  });

  test("the theme chosen in the user menu survives a reload", async ({ page, bitacora }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await bitacora.open();
    expect(await isDark(page)).toBe(false);

    await chooseFromMenu(page, "Oscuro", "menuitemradio");
    await expect.poll(() => isDark(page)).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();
    expect(await isDark(page)).toBe(true);

    await chooseFromMenu(page, "Sistema", "menuitemradio");
    await expect.poll(() => isDark(page)).toBe(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();
    expect(await isDark(page)).toBe(false);
  });
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a tab bar shows one list at a time, starting on En curso, and Mover changes list", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([
      { title: "Ahora", list: "en_curso" },
      { title: "Luego", list: "pendiente" },
    ]);
    await bitacora.open();

    const tabs = page.getByRole("tablist", { name: "Listas" }).getByRole("tab");
    await expect(tabs).toHaveText(["Pendiente1", "Esta semana0", "En curso1", "Hecho0"]);
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(bitacora.list("En curso")).toBeVisible();
    await expect(bitacora.list("Pendiente")).toBeHidden();

    await tabs.nth(0).click();
    await expect(bitacora.list("Pendiente")).toBeVisible();
    await expect(bitacora.list("En curso")).toBeHidden();

    await bitacora.card("Luego").click();
    const card = page.getByRole("dialog", { name: "Tarjeta" });
    await card.getByRole("button", { name: "Mover", exact: true }).click();
    await page.getByLabel("Lista", { exact: true }).selectOption("en_curso");
    await page.getByRole("button", { name: "Mover", exact: true }).last().click();
    await page.keyboard.press("Escape");
    await tabs.nth(2).click();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Ahora", "Luego"]);
  });

  test("the header fits the screen", async ({ page, bitacora }) => {
    await bitacora.open();
    const overflow = await page.evaluate<number>("document.documentElement.scrollWidth - innerWidth");
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("header [aria-haspopup='menu']")).toBeInViewport({ ratio: 1 });
  });
});

test.describe("empty lists", () => {
  test("each empty list says what it is for and keeps its composer", async ({ bitacora }) => {
    await bitacora.open();
    for (const name of ["Pendiente", "Esta semana", "En curso", "Hecho"]) {
      const list = bitacora.list(name);
      await expect(list.getByRole("paragraph")).toHaveCount(1);
      await expect(list.getByRole("button", { name: "Añade una tarjeta" })).toBeVisible();
    }
    await expect(bitacora.list("Hecho").getByRole("button", { name: "Semanas anteriores" })).toHaveCount(0);
  });

  test("a card shows a badge row only when it has something to summarize", async ({ bitacora }) => {
    await bitacora.seed([
      { title: "Sola", list: "en_curso" },
      { title: "Con nota", list: "en_curso", description: "Detalle" },
    ]);
    await bitacora.open();
    await expect(bitacora.card("Sola").getByLabel("Tiene descripción")).toHaveCount(0);
    await expect(bitacora.card("Con nota").getByLabel("Tiene descripción")).toBeVisible();
  });
});
