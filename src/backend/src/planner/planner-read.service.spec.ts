import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import type { WeeklyPlanRevisionRecord } from '../data/schemas';
import { PlannerReadService } from './planner-read.service';

describe('PlannerReadService', () => {
  it('serializes planner revision compaction metadata', () => {
    const service = new PlannerReadService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new DefaultDataFactory(),
    );
    const revision = {
      _id: new Types.ObjectId(),
      revisionNumber: 3,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Updated plan draft.',
          timestamp: new Date('2026-03-14T00:00:00.000Z'),
        },
      ],
      conversationSummary:
        'Recent user requests: Lighter dinners | Higher protein lunches',
      compactedUserMessageCount: 2,
      latestOutput: {
        badge: 'High protein',
        rationale: 'Adjusted for lighter dinners.',
        draftRecipes: [],
        days: [],
      },
    } as unknown as WeeklyPlanRevisionRecord;

    const result = service.toRevisionResponse(revision);

    expect(result.conversationSummary).toBe(
      'Recent user requests: Lighter dinners | Higher protein lunches',
    );
    expect(result.compactedUserMessageCount).toBe(2);
  });
});
