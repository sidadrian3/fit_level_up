import { describe, it, expect } from 'vitest';
import { getQuestProgressUpdates } from '@/lib/domain/quest-rules';
import { QUEST_DEFINITIONS } from '../quest.definitions';

const definitions = Object.values(QUEST_DEFINITIONS);

describe('QUEST_DEFINITIONS', () => {
  it('has unique legacy titles so the id migration is unambiguous', () => {
    const titles = definitions.map((definition) => definition.legacyTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('only uses metrics the progress handlers produce', () => {
    const producedMetrics = new Set(
      [
        ...getQuestProgressUpdates({ type: 'workout_created', xpEarned: 10 }),
        ...getQuestProgressUpdates({ type: 'run_created', distance: 1, xpEarned: 10 }),
      ].map((update) => update.metric),
    );

    for (const definition of definitions) {
      expect(producedMetrics).toContain(definition.metric);
    }
  });
});
