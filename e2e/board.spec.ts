import type { Page } from "@playwright/test";
import { expect, lift, test } from "./fixtures";

const NOT_SAVED = "No se pudo guardar.";

const dialog = (page: Page) => page.getByRole("dialog", { name: "Tarjeta" });
const field = (page: Page) => dialog(page).getByRole("textbox", { name: "Título de la tarjeta" });

test.describe("drag and drop", () => {
  test("a card dropped on another list shows there before the write returns, and stays after a reload", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([
      { title: "Uno", list: "en_curso" },
      { title: "Dos", list: "en_curso" },
      { title: "Tres", list: "pendiente" },
    ]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/cards/*/move", async (route) => {
      await gate;
      await route.continue();
    });
    await bitacora.open();

    const active = bitacora.list("En curso").locator("[data-card-id]");
    await lift(page, bitacora.card("Tres"), bitacora.card("Uno"), "top");
    await page.mouse.up();

    await expect(active).toHaveText(["Tres", "Uno", "Dos"]);
    await expect(bitacora.list("Pendiente").locator("[data-card-id]")).toHaveCount(0);
    // The write is still held, and the card does not move when it returns.
    release();
    await page.waitForResponse((res) => res.url().includes("/move"));
    await expect(active).toHaveText(["Tres", "Uno", "Dos"]);

    await page.reload();
    await expect(active).toHaveText(["Tres", "Uno", "Dos"]);
  });

  test("a failed write puts the card back and offers to retry", async ({ page, bitacora }) => {
    await bitacora.seed([
      { title: "Uno", list: "en_curso" },
      { title: "Tres", list: "pendiente" },
    ]);
    await page.route("**/api/cards/*/move", (route) => route.fulfill({ status: 500, json: { error: "x" } }));
    await bitacora.open();

    await lift(page, bitacora.card("Tres"), bitacora.card("Uno"), "top");
    await page.mouse.up();

    const toast = page.getByRole("status").filter({ hasText: NOT_SAVED });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(bitacora.list("Pendiente").locator("[data-card-id]")).toHaveText(["Tres"]);
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Uno"]);

    await page.unroute("**/api/cards/*/move");
    await toast.getByRole("button", { name: "Reintentar" }).click();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Tres", "Uno"]);
    await page.reload();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Tres", "Uno"]);
  });

  test("a card dropped on a collapsed day header gets that day's date", async ({ page, bitacora }) => {
    const { today } = await bitacora.board();
    const earlier = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const [, moving] = await bitacora.seed([
      { title: "Antes", list: "hecho", doneDate: earlier },
      { title: "Movida", list: "en_curso" },
    ]);
    await bitacora.open();

    const done = bitacora.list("Hecho");
    // On a Monday the day before belongs to an earlier week.
    const older = done.getByRole("button", { name: "Semanas anteriores" });
    if (await older.isVisible()) await older.click();
    const header = done.getByRole("button", { expanded: false });
    await expect(header).toBeVisible();

    await lift(page, bitacora.card("Movida"), header);
    await page.mouse.up();

    await expect(header).toContainText("2");
    await expect
      .poll(async () => (await bitacora.board()).cards.find((card) => card.id === moving!.id)?.doneDate)
      .toBe(earlier);
  });
});

test.describe("card back", () => {
  test("Enter saves the title", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Viejo", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Viejo").click();

    await field(page).click();
    await field(page).fill("Nuevo");
    await field(page).press("Enter");

    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Nuevo"]);
    await expect.poll(async () => (await bitacora.board()).cards[0]?.title).toBe("Nuevo");
  });

  test("leaving the title field saves it", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Viejo", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Viejo").click();

    await field(page).click();
    await field(page).fill("Nuevo");
    await dialog(page).getByRole("heading", { name: "Descripción" }).click();

    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Nuevo"]);
    await expect.poll(async () => (await bitacora.board()).cards[0]?.title).toBe("Nuevo");
  });

  test("Escape restores the old title", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Viejo", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Viejo").click();

    await field(page).click();
    await field(page).fill("Nuevo");
    await field(page).press("Escape");

    await expect(field(page)).toHaveValue("Viejo");
    await expect(dialog(page)).toBeVisible();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Viejo"]);
    expect((await bitacora.board()).cards[0]?.title).toBe("Viejo");
  });

  test("ticking a checklist item saves at once and shows the progress", async ({ page, bitacora }) => {
    await bitacora.seed([
      {
        title: "Con lista",
        list: "en_curso",
        checklist: ["a", "b", "c", "d"].map((text) => ({ text, done: false })),
      },
    ]);
    await bitacora.open();
    await bitacora.card("Con lista").click();

    const progress = dialog(page).getByRole("progressbar");
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await Promise.all([
      page.waitForResponse((res) => res.request().method() === "PATCH"),
      dialog(page).getByRole("checkbox", { name: "Marcar: a" }).check(),
    ]);
    await expect(progress).toHaveAttribute("aria-valuenow", "25");

    await page.reload();
    await expect(dialog(page).getByRole("checkbox", { name: "Marcar: a" })).toBeChecked();
    await expect(dialog(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    await expect(dialog(page).getByText("25%")).toBeVisible();
  });

  test("a card URL opens the card and the back button closes it", async ({ page, bitacora }) => {
    const [card] = await bitacora.seed([{ title: "Enlazada", list: "en_curso" }]);
    await bitacora.open();

    await bitacora.card("Enlazada").click();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(`/c/${card!.id}`);

    await page.goBack();
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL("/");

    await bitacora.open(`/c/${card!.id}`);
    await expect(field(page)).toHaveValue("Enlazada");
    await expect(bitacora.list("En curso")).toBeVisible();
  });

  test("an unknown card URL shows the board and a notice", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Otra", list: "en_curso" }]);
    await bitacora.open("/c/00000000-0000-4000-8000-000000000000");

    await expect(page.getByRole("status").filter({ hasText: "No se encontró la tarjeta." })).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(bitacora.card("Otra")).toBeVisible();
    await expect(page).toHaveURL("/");
  });
});

test("quick edit saves the title with Enter", async ({ page, bitacora }) => {
  await bitacora.seed([{ title: "Viejo", list: "en_curso" }]);
  await bitacora.open();

  await bitacora.card("Viejo").hover();
  await page.keyboard.press("e");
  const title = page.getByRole("textbox", { name: "Título de la tarjeta" });
  await expect(title).toBeFocused();
  await title.fill("Nuevo");
  await expect(
    page.getByRole("button", {
      name: /^(Abrir tarjeta|Etiqueta|Solicitante|Fecha|Mover|Eliminar)$/,
    }),
  ).toHaveText(["Abrir tarjeta", "Etiqueta", "Solicitante", "Fecha", "Mover", "Eliminar"]);
  await title.press("Enter");

  await expect(title).toBeHidden();
  await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Nuevo"]);
  await expect.poll(async () => (await bitacora.board()).cards[0]?.title).toBe("Nuevo");
});

test.describe("completion circle", () => {
  test("finishing puts the card at the top of today and the check puts it back in En curso", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([
      { title: "Vieja", list: "hecho" },
      { title: "Nueva", list: "en_curso" },
    ]);
    await bitacora.open();

    await bitacora.card("Nueva").getByRole("button", { name: "Marcar como hecha" }).click();
    await expect(bitacora.list("Hecho").locator("[data-card-id]")).toHaveText(["Nueva", "Vieja"]);
    await page.reload();
    await expect(bitacora.list("Hecho").locator("[data-card-id]")).toHaveText(["Nueva", "Vieja"]);

    await bitacora.card("Nueva").getByRole("button", { name: "Mover a En curso" }).click();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Nueva"]);
    await expect
      .poll(async () => (await bitacora.board()).cards.map((card) => card.list))
      .toContain("en_curso");
    await page.reload();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Nueva"]);
  });

  test("the circle on the card back finishes the card", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Tarea", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Tarea").click();

    await dialog(page).getByRole("button", { name: "Marcar como hecha" }).click();

    await expect(dialog(page).getByRole("button", { name: "Hecho", exact: true })).toBeVisible();
    await expect(bitacora.list("Hecho").locator("[data-card-id]")).toHaveText(["Tarea"]);
    await expect.poll(async () => (await bitacora.board()).cards[0]?.list).toBe("hecho");
  });
});

test("the composer stays open after Enter and the cards land in order", async ({ page, bitacora }) => {
  await bitacora.open();

  const active = bitacora.list("En curso");
  await active.getByRole("button", { name: "Añade una tarjeta" }).click();
  const input = active.getByRole("textbox", { name: "Título de la tarjeta" });
  await input.fill("Primera");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await input.fill("Segunda");
  await input.press("Enter");

  await expect(active.locator("[data-card-id]")).toHaveText(["Primera", "Segunda"]);
  await expect(input).toBeVisible();
  await page.reload();
  await expect(active.locator("[data-card-id]")).toHaveText(["Primera", "Segunda"]);
});

test("a card opened before its create is answered shows its card back", async ({ page, bitacora }) => {
  await bitacora.open();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/cards", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    await route.fallback();
  });

  const active = bitacora.list("En curso");
  await active.getByRole("button", { name: "Añade una tarjeta" }).click();
  await active.getByRole("textbox", { name: "Título de la tarjeta" }).fill("Recién creada");
  await page.keyboard.press("Enter");
  await bitacora.card("Recién creada").click();

  await expect(field(page)).toHaveValue("Recién creada");
  await expect(page.getByText("No se encontró la tarjeta.")).toBeHidden();

  release();
  await expect.poll(async () => (await bitacora.board()).cards.length).toBe(1);
  const id = (await bitacora.board()).cards[0]!.id;
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/c/${id}$`));
  await expect(field(page)).toHaveValue("Recién creada");
});

test.describe("delete", () => {
  test.beforeEach(async ({ page }) => {
    // The undo window is six seconds of timers. The tests move the clock instead of waiting.
    await page.clock.install();
  });

  test("Deshacer brings the card back and it is never deleted", async ({ page, bitacora }) => {
    await bitacora.seed([
      { title: "Uno", list: "en_curso" },
      { title: "Dos", list: "en_curso" },
    ]);
    await bitacora.open();

    await bitacora.card("Uno").click();
    await dialog(page).getByRole("button", { name: "Eliminar" }).click();
    const active = bitacora.list("En curso").locator("[data-card-id]");
    await expect(active).toHaveText(["Dos"]);

    const toast = page.getByRole("status").filter({ hasText: "Tarjeta eliminada." });
    await toast.getByRole("button", { name: "Deshacer" }).click();
    await expect(active).toHaveText(["Uno", "Dos"]);

    await page.clock.fastForward(10_000);
    await page.reload();
    await expect(active).toHaveText(["Uno", "Dos"]);
  });

  test("the card is deleted when the toast closes", async ({ page, bitacora }) => {
    await bitacora.seed([
      { title: "Uno", list: "en_curso" },
      { title: "Dos", list: "en_curso" },
    ]);
    await bitacora.open();

    await bitacora.card("Uno").click();
    await dialog(page).getByRole("button", { name: "Eliminar" }).click();
    const toast = page.getByRole("status").filter({ hasText: "Tarjeta eliminada." });
    await expect(toast).toBeVisible();
    expect((await bitacora.board()).cards).toHaveLength(2);

    await page.clock.fastForward(6_500);
    await expect(toast).toBeHidden();
    await expect.poll(async () => (await bitacora.board()).cards.length).toBe(1);
    await page.reload();
    await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Dos"]);
  });
});

test("the filter hides cards and a reload keeps it", async ({ page, bitacora }) => {
  await bitacora.seed([
    { title: "Informe mensual", list: "en_curso" },
    { title: "Curso de SQL", list: "pendiente" },
    { title: "Revisar correo", list: "esta_semana", description: "mirar el informe" },
  ]);
  await bitacora.open();

  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.getByRole("textbox", { name: "Texto" }).fill("informe");
  await page.keyboard.press("Escape");

  await expect(bitacora.card("Informe mensual")).toBeVisible();
  await expect(bitacora.card("Revisar correo")).toBeVisible();
  await expect(bitacora.card("Curso de SQL")).toBeHidden();
  await expect(page.getByText("2 tarjetas coinciden")).toBeVisible();

  await page.reload();
  await expect(bitacora.card("Curso de SQL")).toBeHidden();
  await expect(bitacora.card("Informe mensual")).toBeVisible();

  await page.getByRole("button", { name: "Limpiar filtro" }).click();
  await expect(bitacora.card("Curso de SQL")).toBeVisible();
});

test.describe("labels", () => {
  test("clicking a stripe turns every stripe into a named label, and a reload keeps it", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([
      { title: "Uno", list: "en_curso", label: { name: "Desarrollo", color: "green" } },
      { title: "Dos", list: "pendiente", label: { name: "Cursos", color: "purple" } },
      { title: "Tres", list: "pendiente" },
    ]);
    await bitacora.open();

    await expect(bitacora.card("Uno")).not.toContainText("Desarrollo");
    await expect(bitacora.card("Tres").locator("[data-label]")).toHaveCount(0);
    await bitacora
      .card("Uno")
      .getByRole("button", { name: /^Etiqueta Desarrollo/ })
      .click();
    await expect(bitacora.card("Uno")).toContainText("Desarrollo");
    await expect(bitacora.card("Dos")).toContainText("Cursos");
    await expect(dialog(page)).toBeHidden();

    await page.reload();
    await expect(bitacora.card("Dos")).toContainText("Cursos");
    await bitacora
      .card("Dos")
      .getByRole("button", { name: /^Etiqueta Cursos/ })
      .click();
    await expect(bitacora.card("Dos")).not.toContainText("Cursos");
  });

  test("a label made and picked on the card back shows its stripe on the board", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([{ title: "Sin color", list: "en_curso" }]);
    await bitacora.open();
    const stripe = bitacora.card("Sin color").locator("[data-label]");
    await expect(stripe).toHaveCount(0);

    await bitacora.card("Sin color").click();
    await dialog(page).getByRole("button", { name: "Etiqueta", exact: true }).click();
    await page.getByRole("button", { name: "Crear etiqueta" }).click();
    await page.getByRole("textbox", { name: "Nombre" }).fill("Urgente");
    await page.getByRole("radio", { name: "Rojo" }).check({ force: true });
    await page.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialog(page).getByText("Urgente")).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(stripe).toHaveCSS("background-color", "rgb(248, 113, 104)");
    // Closing the card back goes one step back in history; a reload must not cut that short.
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () => (await bitacora.board()).cards[0]?.labelId)
      .toBe((await bitacora.board()).labels[0]!.id);
    await page.reload();
    await expect(stripe).toHaveCSS("background-color", "rgb(248, 113, 104)");

    // Recoloring changes the stripe, and "Sin etiqueta" removes it.
    await bitacora.card("Sin color").click();
    await dialog(page).getByRole("button", { name: "Etiqueta", exact: true }).click();
    await page.getByRole("button", { name: "Editar etiqueta Urgente" }).click();
    await page.getByRole("radio", { name: "Azul" }).check({ force: true });
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Sin etiqueta" }).click();
    await dialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(stripe).toHaveCount(0);
  });

  test("deleting a label clears it from the board", async ({ page, bitacora }) => {
    await bitacora.seed([
      { title: "Marcada", list: "en_curso", label: { name: "Temporal", color: "orange" } },
    ]);
    await bitacora.open();
    await expect(bitacora.card("Marcada").locator("[data-label]")).toHaveCount(1);

    await bitacora.card("Marcada").click();
    await dialog(page).getByRole("button", { name: "Etiqueta", exact: true }).click();
    await page.getByRole("button", { name: "Editar etiqueta Temporal" }).click();
    await page.locator("form").getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    // The popover stays open on the list of labels.
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: "Cerrar" }).click();

    await expect(bitacora.card("Marcada").locator("[data-label]")).toHaveCount(0);
    expect((await bitacora.board()).labels).toEqual([]);
  });

  test("the filter keeps the cards of one label, or of none", async ({ page, bitacora }) => {
    await bitacora.seed([
      { title: "Verde uno", list: "en_curso", label: { name: "Desarrollo", color: "green" } },
      { title: "Morada uno", list: "en_curso", label: { name: "Cursos", color: "purple" } },
      { title: "Libre uno", list: "en_curso" },
    ]);
    await bitacora.open();

    await page.getByRole("button", { name: "Filtrar" }).click();
    await page.getByRole("combobox", { name: "Etiqueta" }).selectOption({ label: "Cursos" });
    await expect(bitacora.card("Morada uno")).toBeVisible();
    await expect(bitacora.card("Verde uno")).toBeHidden();
    await expect(bitacora.card("Libre uno")).toBeHidden();

    await page.getByRole("combobox", { name: "Etiqueta" }).selectOption({ label: "Sin etiqueta" });
    await expect(bitacora.card("Libre uno")).toBeVisible();
    await expect(bitacora.card("Morada uno")).toBeHidden();
  });
});

test.describe("four lists", () => {
  test("each list has its own count and composer, and a card added to Esta semana stays there", async ({
    page,
    bitacora,
  }) => {
    await bitacora.seed([
      { title: "Algún día", list: "pendiente" },
      { title: "Planeada", list: "esta_semana" },
    ]);
    await bitacora.open();

    for (const name of ["Pendiente", "Esta semana", "En curso", "Hecho"]) {
      await expect(bitacora.list(name).getByRole("button", { name: "Añade una tarjeta" })).toBeVisible();
    }
    await expect(bitacora.list("Pendiente").locator("header")).toContainText("1");
    await expect(bitacora.list("Esta semana").locator("header")).toContainText("1");
    await expect(bitacora.list("En curso").locator("header")).toContainText("0");

    const week = bitacora.list("Esta semana");
    await week.getByRole("button", { name: "Añade una tarjeta" }).click();
    await week.getByRole("textbox", { name: "Título de la tarjeta" }).fill("Otra");
    await page.keyboard.press("Enter");
    await expect(week.locator("[data-card-id]")).toHaveText(["Planeada", "Otra"]);
    await expect(week.locator("header")).toContainText("2");
    await page.reload();
    await expect(week.locator("[data-card-id]")).toHaveText(["Planeada", "Otra"]);
  });

  test("the move popover offers the four lists", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Viajera", list: "pendiente" }]);
    await bitacora.open();
    await bitacora.card("Viajera").click();

    await dialog(page).getByRole("button", { name: "Pendiente" }).click();
    await expect(page.getByLabel("Lista").locator("option")).toHaveText([
      "Pendiente (actual)",
      "Esta semana",
      "En curso",
      "Hecho",
    ]);
    await page.getByLabel("Lista").selectOption("esta_semana");
    await page.getByRole("button", { name: "Mover", exact: true }).last().click();

    await expect(bitacora.list("Esta semana").locator("[data-card-id]")).toHaveText(["Viajera"]);
    await expect.poll(async () => (await bitacora.board()).cards[0]?.list).toBe("esta_semana");
  });
});

test("Escape cancels a drag and the card stays where it was", async ({ page, bitacora }) => {
  await bitacora.seed([
    { title: "Uno", list: "en_curso" },
    { title: "Tres", list: "pendiente" },
  ]);
  await bitacora.open();

  await lift(page, bitacora.card("Tres"), bitacora.card("Uno"), "top");
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await expect(bitacora.list("Pendiente").locator("[data-card-id]")).toHaveText(["Tres"]);
  await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Uno"]);
  expect((await bitacora.board()).cards.map((card) => card.list).toSorted()).toEqual([
    "en_curso",
    "pendiente",
  ]);
});

test("an empty list takes a dropped card", async ({ page, bitacora }) => {
  await bitacora.seed([{ title: "Sola", list: "pendiente" }]);
  await bitacora.open();

  await lift(
    page,
    bitacora.card("Sola"),
    bitacora.list("En curso").getByRole("button", { name: "Añade una tarjeta" }),
  );
  await page.mouse.up();

  await expect(bitacora.list("En curso").locator("[data-card-id]")).toHaveText(["Sola"]);
  await expect.poll(async () => (await bitacora.board()).cards[0]?.list).toBe("en_curso");
});

test.describe("keyboard shortcuts", () => {
  test("n opens the composer of the hovered list and ? lists the shortcuts", async ({ page, bitacora }) => {
    await bitacora.open();

    await bitacora.list("Hecho").hover();
    await page.keyboard.press("n");
    await expect(bitacora.list("Hecho").getByRole("textbox", { name: "Título de la tarjeta" })).toBeFocused();
    await page.keyboard.press("Escape");

    await page.mouse.move(0, 400);
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Atajos de teclado" });
    await expect(help.getByRole("row")).toHaveCount(7);
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });

  test("Enter opens the focused card", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Foco", list: "en_curso" }]);
    await bitacora.open();

    await page.locator("[data-card-id]").focus();
    await page.keyboard.press("Enter");
    await expect(field(page)).toHaveValue("Foco");
  });
});

test.describe("card back fields", () => {
  test("the description saves with Ctrl+Enter and Escape cancels", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Con nota", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Con nota").click();

    await dialog(page).getByText("Añade una descripción más detallada…").click();
    const text = dialog(page).getByRole("textbox", { name: "Descripción" });
    await text.fill("No se guarda");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText("Añade una descripción más detallada…")).toBeVisible();

    await dialog(page).getByText("Añade una descripción más detallada…").click();
    await text.fill("Texto final");
    await text.press("Control+Enter");
    await expect(dialog(page).getByText("Texto final")).toBeVisible();
    await expect.poll(async () => (await bitacora.board()).cards[0]?.description).toBe("Texto final");
  });

  test("the checklist composer stays open after Enter", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Con lista", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Con lista").click();

    await dialog(page).getByRole("button", { name: "Checklist", exact: true }).click();
    const input = dialog(page).getByRole("textbox", { name: "Nuevo elemento" });
    await input.fill("Primero");
    await input.press("Enter");
    await expect(input).toBeFocused();
    await input.fill("Segundo");
    await input.press("Enter");

    await expect(dialog(page).getByRole("checkbox")).toHaveCount(2);
    await expect
      .poll(async () => (await bitacora.board()).cards[0]?.checklist.map((item) => item.text))
      .toEqual(["Primero", "Segundo"]);
  });

  test("the date popover refuses a future date", async ({ page, bitacora }) => {
    const { today } = await bitacora.board();
    await bitacora.seed([{ title: "Hecha", list: "hecho" }]);
    await bitacora.open();
    await bitacora.card("Hecha").click();

    await dialog(page).getByRole("button", { name: "Fecha", exact: true }).click();
    const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const popover = page.getByRole("dialog", { name: "Fecha de término" });
    await popover.getByRole("textbox").fill(tomorrow);
    await expect(page.getByText("La fecha no puede ser futura.")).toBeVisible();
    await expect(popover.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  test("the list name opens the move popover", async ({ page, bitacora }) => {
    await bitacora.seed([{ title: "Viajera", list: "en_curso" }]);
    await bitacora.open();
    await bitacora.card("Viajera").click();

    await dialog(page).getByRole("button", { name: "En curso" }).click();
    await page.getByLabel("Lista").selectOption("hecho");
    await page.getByRole("button", { name: "Mover", exact: true }).last().click();

    await expect(bitacora.list("Hecho").locator("[data-card-id]")).toHaveText(["Viajera"]);
    await expect.poll(async () => (await bitacora.board()).cards[0]?.list).toBe("hecho");
  });
});
