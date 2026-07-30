import { vi } from 'vitest';

import type * as NextServer from 'next/server';

// Mock Next.js server features so Vitest doesn't crash.
// We force after() to execute its callback or promise immediately.
// We also use importOriginal to ensure NextResponse isn't deleted.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof NextServer>();
  return {
    ...actual,
    after: (task: (() => void | Promise<void>) | Promise<void>) => {
      if (typeof task === 'function') {
        return task();
      }
      return task;
    },
  };
});
