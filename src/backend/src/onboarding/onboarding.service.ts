import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import { DefaultDataFactory } from '../data/default-data.factory';
import {
  ONBOARDING_QUESTION_MODEL,
  OnboardingQuestionRecord,
  USER_PREFERENCE_MODEL,
  UserPreferenceRecord,
} from '../data/schemas';
import { PlannerService } from '../planner/planner.service';
import { UsersService } from '../users/users.service';

const ONBOARDING_KEY_TO_PROFILE_KEY = {
  diet_style: 'dietStyle',
  allergies_avoids: 'allergies',
  cuisine_preferences: 'cuisinePreferences',
  cooking_time: 'cookingTime',
  nutrition_target: 'nutritionTarget',
  weekly_structure: 'weeklyStructure',
} as const;

@Injectable()
export class OnboardingService implements OnModuleInit {
  constructor(
    @InjectModel(ONBOARDING_QUESTION_MODEL)
    private readonly questionModel: Model<OnboardingQuestionRecord>,
    @InjectModel(USER_PREFERENCE_MODEL)
    private readonly preferenceModel: Model<UserPreferenceRecord>,
    private readonly usersService: UsersService,
    private readonly defaultDataFactory: DefaultDataFactory,
    private readonly plannerService: PlannerService,
  ) {}

  async onModuleInit() {
    const count = await this.questionModel.estimatedDocumentCount();

    if (count > 0) {
      return;
    }

    await this.questionModel.insertMany(
      this.defaultDataFactory.createQuestionBank(),
    );
  }

  async getState(authUser: AuthenticatedUser) {
    const [questions, preference] = await Promise.all([
      this.questionModel.find({ isEnabled: true }).sort({ order: 1 }).lean(),
      this.usersService.getPreferenceDocument(authUser),
    ]);

    const draft =
      preference?.profile ?? this.defaultDataFactory.createDefaultProfile();

    return {
      questions: questions.map((question) => ({
        id: question._id.toString(),
        key: question.key,
        prompt: question.prompt,
        hint: question.hint,
        answerType: question.answerType,
        required: question.required,
        order: question.order,
        isEnabled: question.isEnabled,
        options: question.options ?? [],
        constraints: question.constraints ?? {},
        defaultValue: question.defaultValue ?? null,
        metadata: question.metadata ?? {},
        createdAt: question.createdAt.toISOString(),
        updatedAt: question.updatedAt.toISOString(),
      })),
      draft,
    };
  }

  async saveAnswer(
    authUser: AuthenticatedUser,
    key: keyof typeof ONBOARDING_KEY_TO_PROFILE_KEY,
    value: string | string[],
  ) {
    const profileKey = ONBOARDING_KEY_TO_PROFILE_KEY[key];
    const enabledQuestion = await this.questionModel.findOne({
      key,
      isEnabled: true,
    });

    if (!profileKey || !enabledQuestion) {
      throw new BadRequestException('Invalid onboarding question key.');
    }

    const preference = await this.usersService.getPreferenceDocument(authUser);

    if (!preference) {
      throw new Error('Preference document could not be loaded');
    }
    preference.profile = {
      ...preference.profile,
      [profileKey]: value,
    };
    preference.source = 'onboarding';
    preference.version += 1;
    preference.metadata = {
      ...(preference.metadata ?? {}),
      onboardingCompleted: false,
      draftSavedAt: new Date(),
    };
    await preference.save();

    return preference.profile;
  }

  async complete(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const preference = await this.preferenceModel.findOne({ userId: user._id });

    if (!preference) {
      throw new Error('Preference document not found');
    }

    const previousSource = preference.source;
    const previousVersion = preference.version;
    const previousUpdatedBy = preference.updatedBy ?? null;
    const previousMetadata = { ...(preference.metadata ?? {}) };

    preference.source = 'onboarding';
    preference.version += 1;
    preference.updatedBy = user._id;
    preference.metadata = {
      ...(preference.metadata ?? {}),
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    };
    await preference.save();

    try {
      await this.plannerService.generateCurrent(authUser);
    } catch (error) {
      preference.source = previousSource;
      preference.version = previousVersion;
      preference.updatedBy = previousUpdatedBy;
      preference.metadata = previousMetadata;
      await preference.save();
      throw error;
    }

    return {
      id: preference._id.toString(),
      version: preference.version,
      source: preference.source,
      profile: preference.profile,
    };
  }
}
