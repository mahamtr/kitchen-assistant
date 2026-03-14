import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { DataModule } from '../data/data.module';
import { UsersModule } from '../users/users.module';
import { PlannerAiService } from './planner-ai.service';
import {
  AcceptWeeklyPlanRevisionHandler,
  CreateWeeklyPlanRevisionHandler,
  GenerateCurrentWeeklyPlanHandler,
} from './planner.command-handlers';
import { PlannerController } from './planner.controller';
import { PlannerDraftContextBuilder } from './planner-draft-context.builder';
import { PlannerDraftMaterializer } from './planner-draft-materializer.service';
import { PlannerGroceryProjector } from './planner-grocery-projector.service';
import {
  GetCurrentWeeklyPlanHandler,
  GetLatestWeeklyPlanRevisionHandler,
  GetWeeklyPlanGroceryPreviewHandler,
  GetWeeklyPlanRevisionsHandler,
} from './planner.query-handlers';
import { PlannerReadService } from './planner-read.service';
import { PlannerRecipeCatalogService } from './planner-recipe-catalog.service';
import { PlannerService } from './planner.service';

@Module({
  imports: [AiModule, AuthModule, CqrsModule, DataModule, UsersModule],
  controllers: [PlannerController],
  providers: [
    PlannerAiService,
    PlannerDraftContextBuilder,
    PlannerDraftMaterializer,
    PlannerGroceryProjector,
    PlannerReadService,
    PlannerRecipeCatalogService,
    PlannerService,
    GenerateCurrentWeeklyPlanHandler,
    CreateWeeklyPlanRevisionHandler,
    AcceptWeeklyPlanRevisionHandler,
    GetCurrentWeeklyPlanHandler,
    GetWeeklyPlanRevisionsHandler,
    GetLatestWeeklyPlanRevisionHandler,
    GetWeeklyPlanGroceryPreviewHandler,
  ],
  exports: [PlannerService],
})
export class PlannerModule {}
