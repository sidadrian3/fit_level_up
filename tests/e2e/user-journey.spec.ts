import { test, expect } from '@playwright/test';

test.describe('Critical User Journey', () => {
  // Generate a random email to ensure the test can run repeatedly without collision
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testUser = {
    name: 'E2E Tester',
    email: `tester_${randomSuffix}@example.com`,
    password: 'password123',
  };

  test('Signup, view dashboard, and log a workout', async ({ page }) => {
    // 1. Signup Flow
    await page.goto('/signup');
    await page.fill('input[type="text"]', testUser.name);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back');

    // 2. Navigate to Workouts
    await page.click('text=Workouts');
    await page.waitForURL('/workouts');
    
    // 3. Log a Workout
    await page.fill('input[placeholder="e.g. Upper Body Power"]', 'E2E Power Session');
    
    // Select workout type (Strength is default, but let's click Cardio just to test)
    await page.click('button:has-text("Cardio")');

    // Fill exercise details
    await page.fill('input[placeholder="Exercise name"]', 'Treadmill Sprints');
    // The inputs for sets/reps/weight don't have explicit placeholders, but we can use their labels
    // Wait, the easiest is to just use the default sets=3, reps=10 and submit.
    
    await page.click('button:has-text("Log Workout")');

    // 4. Verify Workout appears in history
    // After logging, the form resets and the history updates. 
    // We should see "E2E Power Session" in the Workout History column.
    const workoutCard = page.locator('h3', { hasText: 'E2E Power Session' });
    await expect(workoutCard).toBeVisible({ timeout: 10000 });
  });
});
