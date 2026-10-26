import { test, expect, type Locator, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function signUpThrowawayAccount(page: Page): Promise<void> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  await page.goto('/signup');
  await page.fill('input[type="text"]', 'E2E Tester');
  await page.fill('input[type="email"]', `tester_${suffix}@example.com`);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome back');
}

function sidebarOf(page: Page): Locator {
  return page.getByRole('complementary');
}

async function goTo(page: Page, linkName: string, path: string): Promise<void> {
  await sidebarOf(page).getByRole('link', { name: linkName, exact: true }).click();
  await page.waitForURL(path);
}

function sidebarXp(page: Page): Locator {
  return sidebarOf(page).getByText(/^\d+ \/ \d+ XP$/);
}

async function readSidebarXp(page: Page): Promise<string> {
  await expect(sidebarXp(page)).toBeVisible();
  return (await sidebarXp(page).innerText()).trim();
}

async function logWorkout(page: Page, title: string): Promise<void> {
  await page.getByPlaceholder('e.g. Upper Body Power').fill(title);
  await page.getByRole('combobox').first().selectOption({ label: 'Bench Press' });
  await page.getByRole('button', { name: 'Log Workout' }).click();
}

function questCard(page: Page, title: string): Locator {
  return page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
}

async function readQuestProgress(card: Locator): Promise<number> {
  const progress = card.getByText(/^\d+\s*\/\s*\d+$/);
  await expect(progress).toBeVisible();
  const text = await progress.innerText();
  return Number(text.split('/')[0].trim());
}

test.describe('Critical User Journey', () => {
  test('Signup, view dashboard, and log a workout', async ({ page }) => {
    await signUpThrowawayAccount(page);

    await goTo(page, 'Workouts', '/workouts');
    await logWorkout(page, 'E2E Power Session');

    const workoutCard = page.locator('h3', { hasText: 'E2E Power Session' });
    await expect(workoutCard).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Cross-screen refresh', () => {
  test('Logging and deleting activity refreshes the other screens without a reload', async ({ page }) => {
    await signUpThrowawayAccount(page);

    await goTo(page, 'Quests', '/quests');
    // Daily Burn completes after one workout and swaps its progress for a Claim button, so the +1 is read on Weekly Consistency.
    const weeklyWorkouts = questCard(page, 'Weekly Consistency');
    const weeklyBefore = await readQuestProgress(weeklyWorkouts);
    await expect(questCard(page, 'Daily Burn').getByText('Progress')).toBeVisible();

    await goTo(page, 'Workouts', '/workouts');
    const xpAtStart = await readSidebarXp(page);
    await logWorkout(page, 'E2E Refresh Session');
    const workoutCard = page.locator('h3', { hasText: 'E2E Refresh Session' });
    await expect(workoutCard).toBeVisible();
    await expect(sidebarXp(page)).not.toHaveText(xpAtStart);
    const xpAfterWorkout = await readSidebarXp(page);

    await goTo(page, 'Quests', '/quests');
    await expect(questCard(page, 'Daily Burn').getByRole('button', { name: /^Claim/ })).toBeVisible();
    expect(await readQuestProgress(weeklyWorkouts)).toBe(weeklyBefore + 1);

    await goTo(page, 'Running', '/runs');
    const totalRuns = page.getByText('Total Runs', { exact: true }).locator('xpath=preceding-sibling::div[1]');
    await expect(totalRuns).toHaveText('0');
    await page.getByRole('button', { name: 'Log Run' }).click();
    await expect(totalRuns).toHaveText('1');
    await expect(sidebarXp(page)).not.toHaveText(xpAfterWorkout);
    const xpAfterRun = await readSidebarXp(page);

    await goTo(page, 'Profile', '/profile');
    const records = page.getByRole('heading', { name: 'Personal Records' }).locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
    await expect(records.getByText('Longest Run')).toBeVisible();

    await goTo(page, 'Workouts', '/workouts');
    await expect(workoutCard).toBeVisible();
    await page.getByRole('button', { name: 'Delete workout' }).click();
    await expect(workoutCard).toHaveCount(0);
    await expect(sidebarXp(page)).not.toHaveText(xpAfterRun);
    const xpAfterDelete = await readSidebarXp(page);
    expect(Number(xpAfterDelete.split(' / ')[0])).toBeLessThan(Number(xpAfterRun.split(' / ')[0]));
  });

  test('A custom exercise can be used in a template that is then offered when starting a workout', async ({ page }) => {
    await signUpThrowawayAccount(page);
    // The server stores custom exercise names sentence-cased, so use that casing up front.
    const exerciseName = `E2e Lunge ${Date.now()}`;
    const templateName = `E2E Template ${Date.now()}`;

    await page.goto('/templates/new');
    await page.getByLabel('Template Name').fill(templateName);

    await page.getByRole('button', { name: 'Create Custom' }).click();
    await page.getByPlaceholder('e.g. Bulgarian Split Squat').fill(exerciseName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    const picker = page.getByRole('combobox', { name: 'Select exercise' });
    await expect(picker).toHaveValue(exerciseName);
    await expect(picker.getByRole('option', { name: exerciseName })).toHaveCount(1);

    await page.getByRole('button', { name: 'Save Template' }).click();
    await page.waitForURL('/workouts');

    await page.getByRole('button', { name: 'Templates' }).click();
    const modal = page.getByRole('dialog', { name: 'Start from Template' });
    await expect(modal.getByText(templateName)).toBeVisible();
  });

  test('A custom exercise logged from the workout form keeps its target muscle', async ({ page }) => {
    await signUpThrowawayAccount(page);
    const exerciseName = `E2e Sled Push ${Date.now()}`;
    const workoutTitle = `E2E Legs ${Date.now()}`;

    await goTo(page, 'Workouts', '/workouts');
    await page.getByRole('button', { name: 'Create Custom' }).click();
    await page.getByPlaceholder('e.g. Bulgarian Split Squat').fill(exerciseName);
    const createForm = page.locator('form').filter({ has: page.getByPlaceholder('e.g. Bulgarian Split Squat') });
    await createForm.getByRole('combobox').selectOption({ label: 'Legs' });
    await createForm.getByRole('button', { name: 'Create', exact: true }).click();

    await page.getByPlaceholder('e.g. Upper Body Power').fill(workoutTitle);
    await page.getByRole('button', { name: 'Log Workout' }).click();

    const card = page.locator('h3', { hasText: workoutTitle }).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
    await expect(card.getByText('Legs Day')).toBeVisible({ timeout: 10000 });
  });
});
