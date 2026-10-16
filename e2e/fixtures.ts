import { expect, test as base, type Locator, type Page } from "@playwright/test";
import type { Board, Card, DoneWeek, ListId } from "../src/shared/model";

const PASSWORD = "bitacora-dev";

type Seed = {
  title: string;
  list: ListId;
  later?: boolean;
  doneDate?: string;
  description?: string;
  category?: Card["category"];
  requester?: string;
  checklist?: Card["checklist"];
};

export type Bitacora = {
  /** Creates cards through the API, in order, and returns them as stored. */
  seed(cards: Seed[]): Promise<Card[]>;
  /** The board as the server stores it. */
  board(): Promise<Board>;
  open(path?: string): Promise<void>;
  card(title: string): Locator;
  list(name: string): Locator;
};

async function allCards(page: Page): Promise<Card[]> {
  const board = (await (await page.request.get("/api/board")).json()) as Board;
  const cards = [...board.cards];
  for (let week = board.olderWeek; week;) {
    const done = (await (await page.request.get(`/api/done?week=${week}`)).json()) as DoneWeek;
    cards.push(...done.cards);
    week = done.olderWeek;
  }
  return cards;
}

export const test = base.extend<{ bitacora: Bitacora }>({
  bitacora: async ({ page }, use) => {
    // Logging in is not under test, so it goes through the API.
    const login = await page.request.post("/login", { form: { password: PASSWORD }, maxRedirects: 0 });
    expect(login.status()).toBe(303);
    for (const card of await allCards(page)) await page.request.delete(`/api/cards/${card.id}`);

    await use({
      async seed(cards) {
        const created: Card[] = [];
        for (const { title, list, later, doneDate, ...fields } of cards) {
          const res = await page.request.post("/api/cards", { data: { title, list, later: later ?? false } });
          let card = (await res.json()) as Card;
          if (doneDate || Object.keys(fields).length > 0) {
            const patch = await page.request.patch(`/api/cards/${card.id}`, {
              data: { ...fields, doneDate },
            });
            card = (await patch.json()) as Card;
          }
          created.push(card);
        }
        return created;
      },
      async board() {
        return (await (await page.request.get("/api/board")).json()) as Board;
      },
      async open(path = "/") {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();
        await expect(page.getByRole("region", { name: "En curso" })).toBeVisible();
      },
      card: (title) => page.locator("[data-card-id]", { hasText: title }),
      list: (name) => page.getByRole("region", { name, exact: true }),
    });
  },
});

export { expect };

/**
 * Lifts a card with the pointer, passes the drag threshold and moves over the target.
 * The pointer stays down: the test releases it with `page.mouse.up()`.
 */
export async function lift(
  page: Page,
  card: Locator,
  target: Locator,
  where: "top" | "middle" | "bottom" = "middle",
) {
  const from = (await card.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 4 });
  // Lifting a card can add a drop target, such as today in Hecho, and move the others.
  await page.evaluate("new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))");
  const to = (await target.boundingBox())!;
  const x = to.x + to.width / 2;
  const y = where === "top" ? to.y + 4 : where === "bottom" ? to.y + to.height - 4 : to.y + to.height / 2;
  await page.mouse.move(x, y, { steps: 12 });
}
