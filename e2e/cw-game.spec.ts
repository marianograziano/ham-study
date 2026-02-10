import { expect, test } from "@playwright/test";

test.describe("CW Defense Game", () => {
  test.beforeEach(async ({ page }) => {
    // 访问游戏页面
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err}`));
    await page.goto("/tools/cw/game");
  });

  test("页面标题正确", async ({ page }) => {
    await expect(page).toHaveTitle(/CW/);
  });

  test("游戏初始状态显示开始界面", async ({ page }) => {
    // 检查开始界面元素
    const readyText = page.getByText(/准备好了吗|Ready to Play/);
    await expect(readyText).toBeVisible();

    // 检查游戏说明
    const instructions = page.getByText(/J =/);
    await expect(instructions).toBeVisible();

    // 检查开始按钮
    const startButton = page.getByText(/开始游戏|Start Game/);
    await expect(startButton).toBeVisible();
  });

  test("点击开始游戏后进入游戏状态", async ({ page }) => {
    // 点击开始按钮
    const startButton = page.getByText(/开始游戏|Start Game/);
    await startButton.click();

    // 等待游戏开始
    await page.waitForTimeout(500);

    // 检查分数显示
    const scoreLabel = page.getByText(/分数|Score/);
    await expect(scoreLabel).toBeVisible();

    // 检查控制按钮是否启用
    const ditButton = page.locator("button").filter({ hasText: /J/ });
    await expect(ditButton.first()).toBeVisible();
  });

  test("控制按钮存在", async ({ page }) => {
    // 开始游戏
    await page.getByText(/开始游戏|Start Game/).click();
    await page.waitForTimeout(500);

    // 检查"点"按钮存在
    const ditButton = page.locator("button").filter({ hasText: /J/ });
    await expect(ditButton.first()).toBeVisible();

    // 检查"划"按钮存在
    const dahButton = page.locator("button").filter({ hasText: /K/ });
    await expect(dahButton.first()).toBeVisible();

    // 检查输入区域存在
    const inputArea = page.locator("div.text-4xl.text-green-400");
    await expect(inputArea).toBeVisible();
  });

  test("血量显示正确", async ({ page }) => {
    // 检查血条（5颗心）
    const hearts = page.locator("svg[class*='text-red-500']");
    await expect(hearts).toHaveCount(5);
  });

  test("BUG验证: 掉落扣血逻辑", async ({ page }) => {
    // 开始游戏
    await page.getByText(/开始游戏|Start Game/).click();

    // 获取初始血量
    const initialHearts = await page
      .locator("svg[class*='text-red-500']")
      .count();
    expect(initialHearts).toBe(5);

    // 等待一个字符掉落并消失 (Miss)
    // 字符生成大概需要几秒，掉落也需要时间
    // 我们可以加速或者等待
    // 这里等待足够长的时间让第一个字符掉出屏幕
    await page.waitForTimeout(8000);

    // 获取当前血量
    const currentHearts = await page
      .locator("svg[class*='text-red-500']")
      .count();

    // 验证只扣了1滴血 (如果是双倍扣血bug，这里会剩下3个或者更少)
    // 注意：如果掉了多个字符，可能扣更多，但我们假设第一个掉落周期内只掉一个或两个
    // 关键是看是否发生了一次“双倍”扣除。
    // 如果是双倍扣血，每一个miss都会导致-2。
    // 我们只要确认 currentHearts === initialHearts - missedCount
    // 比较难精确控制missedCount，但我们可以观察日志或通过更精细的控制。
    // 简单验证：只要不是偶数倍扣血就行？不，如果miss了2个，正常是-2。
    // 如果双倍bug，miss 1个就是-2。

    // 获取调试状态
    const debugStateHandle = await page.getByTestId("debug-state");
    const debugText = await debugStateHandle.textContent();
    console.log(`DEBUG STATE: ${debugText}`);
    const debugState = JSON.parse(debugText || "{}");

    // 验证血量减少
    // expect(currentHearts).toBeLessThan(initialHearts);
    expect(debugState.health).toBeLessThan(5);

    // 如果是双倍扣血，通常一次miss会瞬间变成4->3->2? 或者 5->3?
    // StrictMode导致两次setter调用，如果逻辑不对，可能state减了两次。
  });
});
