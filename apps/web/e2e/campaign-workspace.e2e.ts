import { expect, test } from "@playwright/test";

test("persists a draggable, resizable, duplicate-safe Campaign workspace", async ({
  page,
  request,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const worldResponse = await request.post("/api/worlds", {
    data: { name: `E2E World ${suffix}` },
  });
  expect(worldResponse.ok()).toBeTruthy();
  const world = (await worldResponse.json()) as { id: string };

  const campaignResponse = await request.post(
    `/api/worlds/${world.id}/campaigns`,
    { data: { name: `E2E Campaign ${suffix}` } },
  );
  expect(campaignResponse.ok()).toBeTruthy();
  const campaign = (await campaignResponse.json()) as { id: string };

  const entryResponse = await request.post(
    `/api/campaigns/${campaign.id}/entries`,
    { data: { type: "NPC", title: `Mira ${suffix}`, scope: "campaign" } },
  );
  expect(entryResponse.ok()).toBeTruthy();
  const entry = (await entryResponse.json()) as { id: string; title: string };

  await page.goto(`/campaigns/${campaign.id}/workspace`);
  await page.getByRole("button", { name: new RegExp(entry.title) }).click();

  const entryWindow = page.locator(`[data-entry-window="${entry.id}"]`);
  await expect(entryWindow).toBeVisible();
  await expect(page.locator(`[data-entry-window="${entry.id}"]`)).toHaveCount(
    1,
  );

  await page
    .getByRole("button", { name: new RegExp(entry.title) })
    .first()
    .click();
  await expect(page.locator(`[data-entry-window="${entry.id}"]`)).toHaveCount(
    1,
  );

  const titlebar = entryWindow.locator(".workspace-window-titlebar");
  const beforeDrag = await entryWindow.boundingBox();
  const titlebarBox = await titlebar.boundingBox();
  if (!beforeDrag || !titlebarBox)
    throw new Error("Entry window has no geometry");
  await page.mouse.move(titlebarBox.x + 120, titlebarBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(titlebarBox.x + 220, titlebarBox.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Workspace saved")).toBeVisible();
  const afterDrag = await entryWindow.boundingBox();
  expect(afterDrag?.x).toBeGreaterThan(beforeDrag.x + 50);
  expect(afterDrag?.y).toBeGreaterThan(beforeDrag.y + 30);

  const resizeHandle = entryWindow.locator(".workspace-resize-handle");
  const resizeBox = await resizeHandle.boundingBox();
  const beforeResize = await entryWindow.boundingBox();
  if (!resizeBox || !beforeResize)
    throw new Error("Resize handle has no geometry");
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2,
    resizeBox.y + resizeBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 90, resizeBox.y + 70, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Workspace saved")).toBeVisible();
  const afterResize = await entryWindow.boundingBox();
  expect(afterResize?.width).toBeGreaterThan(beforeResize.width + 40);
  expect(afterResize?.height).toBeGreaterThan(beforeResize.height + 30);

  await page.getByRole("button", { name: `Minimize ${entry.title}` }).click();
  await expect(entryWindow).toBeHidden();
  await page.getByRole("button", { name: `Restore ${entry.title}` }).click();
  await expect(entryWindow).toBeVisible();
  await expect(page.getByText("Workspace saved")).toBeVisible();

  const beforeReload = await entryWindow.boundingBox();
  await page.reload();
  await expect(entryWindow).toBeVisible();
  const afterReload = await entryWindow.boundingBox();
  expect(afterReload?.x).toBeCloseTo(beforeReload?.x ?? 0, 0);
  expect(afterReload?.y).toBeCloseTo(beforeReload?.y ?? 0, 0);
  expect(afterReload?.width).toBeCloseTo(beforeReload?.width ?? 0, 0);
  expect(afterReload?.height).toBeCloseTo(beforeReload?.height ?? 0, 0);
});
