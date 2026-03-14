import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import { UsersService } from './users.service';

type FindOneAndUpdateArgs = [
  Record<string, unknown>,
  {
    $set?: Record<string, unknown>;
    $setOnInsert?: Record<string, unknown>;
  },
  Record<string, unknown>,
];

type ModelMock = {
  create: jest.Mock;
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock<Promise<unknown>, FindOneAndUpdateArgs>;
};

function createModelMock(): ModelMock {
  return {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn<Promise<unknown>, FindOneAndUpdateArgs>(),
  };
}

describe('UsersService', () => {
  const defaultDataFactory = new DefaultDataFactory();

  it('creates a draft preference document when bootstrapping a new user', async () => {
    const userId = new Types.ObjectId();
    const userModel = createModelMock();
    const preferenceModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const service = new UsersService(
      userModel as never,
      preferenceModel as never,
      weeklyPlanModel as never,
      defaultDataFactory,
    );

    userModel.findOneAndUpdate.mockResolvedValue({
      _id: userId,
      supabaseUserId: 'supabase-user-1',
      email: 'user@example.com',
      displayName: 'Example User',
      status: 'active',
      lastSeenAt: new Date(),
    });
    preferenceModel.findOne.mockResolvedValueOnce(null);
    preferenceModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
    });

    await service.ensureUser({
      sub: 'supabase-user-1',
      email: 'user@example.com',
      user_metadata: { displayName: 'Example User' },
    });

    const [filter, update, options] = userModel.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({ supabaseUserId: 'supabase-user-1' });
    expect(update.$set).toMatchObject({
      email: 'user@example.com',
      displayName: 'Example User',
      status: 'active',
    });
    expect(options).toEqual({
      returnDocument: 'after',
      upsert: true,
    });
    expect(preferenceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        source: 'onboarding',
        version: 0,
        metadata: { onboardingCompleted: false },
      }),
    );
  });

  it('hides draft preferences from the completed preference endpoint', async () => {
    const userModel = createModelMock();
    const preferenceModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const service = new UsersService(
      userModel as never,
      preferenceModel as never,
      weeklyPlanModel as never,
      defaultDataFactory,
    );

    userModel.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      supabaseUserId: 'supabase-user-1',
      email: 'user@example.com',
      displayName: 'Example User',
      status: 'active',
      lastSeenAt: new Date(),
    });
    preferenceModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      profile: defaultDataFactory.createDefaultProfile(),
      source: 'onboarding',
      version: 1,
      metadata: { onboardingCompleted: false },
    });

    const result = await service.getCompletedPreference({
      sub: 'supabase-user-1',
      email: 'user@example.com',
      user_metadata: { displayName: 'Example User' },
    });

    expect(result).toBeNull();
  });

  it('does not manually upsert mongoose timestamps for users', async () => {
    const userModel = createModelMock();
    const preferenceModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const service = new UsersService(
      userModel as never,
      preferenceModel as never,
      weeklyPlanModel as never,
      defaultDataFactory,
    );

    userModel.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      supabaseUserId: 'supabase-user-2',
      email: 'user2@example.com',
      displayName: 'Example User Two',
      status: 'active',
      lastSeenAt: new Date(),
    });
    preferenceModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
    });

    await service.ensureUser({
      sub: 'supabase-user-2',
      email: 'user2@example.com',
      user_metadata: { displayName: 'Example User Two' },
    });

    const [, update] = userModel.findOneAndUpdate.mock.calls[0];

    expect(update).not.toHaveProperty('$setOnInsert');
    expect(update.$set).not.toHaveProperty('createdAt');
    expect(update.$set).not.toHaveProperty('updatedAt');
  });
});
