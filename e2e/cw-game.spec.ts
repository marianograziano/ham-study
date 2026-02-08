import { test, expect } from "@playwright/test";

test.describe("CW Defense Game", () => {
  test.beforeEach(async ({ page }) => {
    // 访问游戏页面
    await page.goto("http://localhost:8787/tools/cw/game");
    // 等待页面加载
    await page.waitForLoadState("networkidle");
  });

  test("页面标题正确", async ({ page }) => {
    await expect(page).toHaveTitle(/CW 防御战/);
  });

  test("游戏初始状态显示开始界面", async ({ page }) => {
    // 检查开始界面元素
    const readyText = page.getByText("准备好了吗？");
    await expect(readyText).toBeVisible();
    
    // 检查游戏说明
    const instructions = page.getByText(/按空格键输入/);
    await expect(instructions).toBeVisible();
    
    // 检查开始按钮
    const startButton = page.getByText("开始游戏");
    await expect(startButton).toBeVisible();
  });

  test("点击开始游戏后进入游戏状态", async ({ page }) => {
    // 点击开始按钮
    const startButton = page.getByText("开始游戏");
    await startButton.click();
    
    // 等待游戏开始
    await page.waitForTimeout(500);
    
    // 检查分数显示
    const scoreLabel = page.getByText("分数");
    await expect(scoreLabel).toBeVisible();
    
    // 检查控制按钮是否启用（使用更精确的选择器）
    const ditButton = page.locator('button:has-text("点"):has-text("Space")');
    await expect(ditButton).toBeVisible();
  });

  test("控制按钮存在", async ({ page }) => {
    // 开始游戏
    await page.getByText("开始游戏").click();
    await page.waitForTimeout(500);
    
    // 检查"点"按钮存在
    const ditButton = page.locator('button:has-text("Space")');
    await expect(ditButton).toBeVisible();
    
    // 检查"划"按钮存在
    const dahButton = page.locator('button:has-text("Enter")');
    await expect(dahButton).toBeVisible();
    
    // 检查输入区域存在
    const inputArea = page.locator('.text-4xl.text-green-400');
    await expect(inputArea).toBeVisible();
  });

  test("血量显示正确", async ({ page }) => {
    // 检查血条（5颗心）
    const hearts = page.locator("svg[class*='text-red-500']");
    await expect(hearts).toHaveCount(5);
  });

  test("城墙线可见", async ({ page }) => {
    // 检查城墙文字
    const wallText = page.getByText("防御城墙");
    await expect(wallText).toBeVisible();
  });

  test("游戏暂停功能", async ({ page }) => {
    // 开始游戏
    await page.getByText("开始游戏").click();
    await page.waitForTimeout(500);
    
    // 按 ESC 暂停
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    
    // 检查暂停界面
    const pausedText = page.getByText("已暂停");
    await expect(pausedText).toBeVisible();
    
    // 检查继续按钮
    const resumeButton = page.getByText("继续");
    await expect(resumeButton).toBeVisible();
  });
});
