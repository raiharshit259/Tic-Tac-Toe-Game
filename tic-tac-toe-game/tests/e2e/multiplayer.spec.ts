import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

async function waitConnected(page: Page): Promise<void> {
  const continueButton = page.getByRole("button", { name: "Continue To Home" });
  await expect(continueButton).toBeEnabled({ timeout: 25_000 });
}

async function enterUsername(page: Page, username: string): Promise<void> {
  await waitConnected(page);
  await page.getByPlaceholder("Enter username").fill(username);
  await page.getByRole("button", { name: "Continue To Home" }).click();
  await expect(page.getByRole("button", { name: "Play Online" })).toBeVisible();
}

async function waitPhasePlaying(page: Page): Promise<void> {
  await expect(page.getByText(/Your turn|Opponent turn/i)).toBeVisible({ timeout: 10_000 });
}

function roomCodeFromUI(roomText: string): string {
  const match = roomText.match(/Room\s+([A-Za-z0-9_-]+)/i);
  if (!match) {
    throw new Error(`Could not parse room id from: ${roomText}`);
  }
  return match[1].trim();
}

function countdownNumber(scope: Locator): Promise<number> {
  return scope.textContent().then((text) => Number((text || "0").replace(/[^0-9]/g, "")) || 0);
}

async function waitForResult(page: Page): Promise<void> {
  await expect(page.getByText(/Victory|Defeat|Draw/i)).toBeVisible({ timeout: 45_000 });
}

async function boardCell(page: Page, index: number): Promise<Locator> {
  return page.locator(`[data-cell-index="${index}"]`);
}

async function moveIfVisible(page: Page, index: number): Promise<void> {
  const cell = await boardCell(page, index);
  await expect(cell).toBeVisible();
  await cell.click();
}

async function cellHasMark(page: Page, index: number): Promise<boolean> {
  const cell = await boardCell(page, index);
  return cell.evaluate((el) => el.querySelector("svg") !== null);
}

async function markedCellCount(page: Page): Promise<number> {
  return page.locator("[data-cell-index]").evaluateAll((cells) => {
    return cells.filter((cell) => cell.querySelector("svg") !== null).length;
  });
}

async function openLeaderboard(page: Page): Promise<void> {
  const homeButton = page.getByRole("button", { name: "Return Home" });
  if (await homeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await homeButton.click();
  }
  await expect(page.getByRole("button", { name: "Leaderboard" })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Leaderboard" }).click({ force: true });
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible({ timeout: 8_000 });
}

test.describe("multiplayer ui e2e", () => {
  test.setTimeout(120_000);

  test("theme toggle switches app mode", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Toggle theme" });
    await expect(button).toBeVisible();

    const before = await page.evaluate(() => document.documentElement.className);
    await button.click({ force: true });
    await expect
      .poll(async () => {
        const after = await page.evaluate(() => document.documentElement.className);
        return after !== before;
      }, { timeout: 4_000 })
      .toBeTruthy();
  });

  test("matchmaking, gameplay sync, timer timeout, leaderboard, and reconnect", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const userA = uniqueName("PW_A");
    const userB = uniqueName("PW_B");

    await pageA.goto("/");
    await pageB.goto("/");

    await enterUsername(pageA, userA);
    await enterUsername(pageB, userB);

    await pageA.getByRole("button", { name: "Play Online" }).click({ force: true });
    await pageB.getByRole("button", { name: "Play Online" }).click({ force: true });

    await waitPhasePlaying(pageA);
    await waitPhasePlaying(pageB);

    await expect(pageA.getByText(userA)).toBeVisible();
    await expect(pageA.getByText(userB)).toBeVisible();
    await expect(pageB.getByText(userA)).toBeVisible();
    await expect(pageB.getByText(userB)).toBeVisible();

    await moveIfVisible(pageA, 0);
    await expect.poll(async () => cellHasMark(pageB, 0), { timeout: 5_000 }).toBeTruthy();

    const timerA = pageA.getByText(/\d+s/).first();
    const timerB = pageB.getByText(/\d+s/).first();
    const aVal = await countdownNumber(timerA);
    const bVal = await countdownNumber(timerB);
    expect(Math.abs(aVal - bVal)).toBeLessThanOrEqual(2);

    await waitForResult(pageA);
    await waitForResult(pageB);

    await pageB.reload();
    await expect(pageB.getByText(/Victory|Defeat|Draw/i)).toBeVisible({ timeout: 20_000 });

    await openLeaderboard(pageA);
    await expect(pageA.getByText(/^#\d+$/).first()).toBeVisible({ timeout: 10_000 });

    await contextA.close();
    await contextB.close();
  });

  test("single player matchmaking falls back to bot after timeout", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const user = uniqueName("BOT_WAIT");
    await page.goto("/");
    await enterUsername(page, user);

    await page.getByRole("button", { name: "Play Online" }).click({ force: true });

    await expect(page.getByRole("heading", { name: "Waiting For Player" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Your turn|Opponent turn/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Nakama Bot")).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText("Your turn")).toBeVisible({ timeout: 10_000 });
    await moveIfVisible(page, 0);

    await expect
      .poll(async () => markedCellCount(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);

    await context.close();
  });

  test("create room and join room transitions from waiting to playing", async ({ browser }) => {
    const contextA: BrowserContext = await browser.newContext();
    const contextB: BrowserContext = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const userA = uniqueName("ROOM_A");
    const userB = uniqueName("ROOM_B");

    await pageA.goto("/");
    await pageB.goto("/");

    await enterUsername(pageA, userA);
    await enterUsername(pageB, userB);

    await pageA.getByRole("button", { name: "Create Room" }).click({ force: true });
    await pageA.getByRole("button", { name: "Create Private Room" }).click({ force: true });

    await expect(pageA.getByRole("heading", { name: "Waiting For Player" })).toBeVisible({ timeout: 5_000 });

    const roomText = await pageA.getByText(/^Room\s+/).first().textContent();
    const roomId = roomCodeFromUI(roomText || "");

    await pageB.getByRole("button", { name: "Join Room" }).click({ force: true });
    await pageB.getByPlaceholder("Paste full room id").fill(roomId);
    await pageB.getByRole("button", { name: "Join Private Room" }).click({ force: true });

    await expect(pageA.locator('[data-cell-index="0"]')).toBeVisible({ timeout: 8_000 });
    await expect(pageB.locator('[data-cell-index="0"]')).toBeVisible({ timeout: 30_000 });

    await waitPhasePlaying(pageA);
    await waitPhasePlaying(pageB);

    await expect(pageA.getByText(userA)).toBeVisible();
    await expect(pageA.getByText(userB)).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
