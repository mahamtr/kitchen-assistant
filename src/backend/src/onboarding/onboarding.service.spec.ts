import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import { OnboardingService } from './onboarding.service';

function createModelMock() {
  return {
    estimatedDocumentCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    insertMany: jest.fn(),
  };
}

describe('OnboardingService', () => {
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  it('marks onboarding complete and generates the initial weekly plan', async () => {
    const userId = new Types.ObjectId();
    const questionModel = createModelMock();
    const preferenceModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
      getPreferenceDocument: jest.fn(),
    };
    const defaultDataFactory = new DefaultDataFactory();
    const plannerService = {
      generateCurrent: jest.fn().mockResolvedValue({
        id: 'plan-1',
      }),
    };
    const preference = {
      _id: new Types.ObjectId(),
      userId,
      profile: defaultDataFactory.createDefaultProfile(),
      source: 'onboarding',
      version: 1,
      updatedBy: null,
      metadata: { onboardingCompleted: false },
      save: jest.fn().mockResolvedValue(undefined),
    };

    preferenceModel.findOne.mockResolvedValue(preference);

    const service = new OnboardingService(
      questionModel as never,
      preferenceModel as never,
      usersService as never,
      defaultDataFactory,
      plannerService as never,
    );

    const result = await service.complete({
      ...authUser,
    } as never);

    expect(preference.save).toHaveBeenCalled();
    expect(plannerService.generateCurrent).toHaveBeenCalledWith(authUser);
    expect(result.version).toBe(2);
    expect(result.source).toBe('onboarding');
  });

  it('rejects answers for unknown onboarding keys', async () => {
    const questionModel = createModelMock();
    const preferenceModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn(),
      getPreferenceDocument: jest.fn(),
    };
    const plannerService = {
      generateCurrent: jest.fn(),
    };
    const service = new OnboardingService(
      questionModel as never,
      preferenceModel as never,
      usersService as never,
      new DefaultDataFactory(),
      plannerService as never,
    );

    questionModel.findOne.mockResolvedValue(null);

    await expect(
      service.saveAnswer(authUser as never, 'invalid_key' as never, 'value'),
    ).rejects.toThrow('Invalid onboarding question key.');
    expect(usersService.getPreferenceDocument).not.toHaveBeenCalled();
  });

  it('reverts onboarding completion when initial plan generation fails', async () => {
    const userId = new Types.ObjectId();
    const questionModel = createModelMock();
    const preferenceModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
      getPreferenceDocument: jest.fn(),
    };
    const defaultDataFactory = new DefaultDataFactory();
    const plannerService = {
      generateCurrent: jest.fn().mockRejectedValue(new Error('Planner failed')),
    };
    const preference = {
      _id: new Types.ObjectId(),
      userId,
      profile: defaultDataFactory.createDefaultProfile(),
      source: 'onboarding',
      version: 1,
      updatedBy: null,
      metadata: { onboardingCompleted: false },
      save: jest.fn().mockResolvedValue(undefined),
    };

    preferenceModel.findOne.mockResolvedValue(preference);

    const service = new OnboardingService(
      questionModel as never,
      preferenceModel as never,
      usersService as never,
      defaultDataFactory,
      plannerService as never,
    );

    await expect(service.complete(authUser as never)).rejects.toThrow(
      'Planner failed',
    );
    expect(preference.save).toHaveBeenCalledTimes(2);
    expect(preference.source).toBe('onboarding');
    expect(preference.version).toBe(1);
    expect(preference.updatedBy).toBeNull();
    expect(preference.metadata).toEqual({ onboardingCompleted: false });
  });
});
