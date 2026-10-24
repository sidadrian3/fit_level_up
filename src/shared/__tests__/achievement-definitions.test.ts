import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_DEFINITIONS } from '../achievement-definitions';

describe('ACHIEVEMENT_DEFINITIONS', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENT_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
