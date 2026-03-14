import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { DataModule } from '../data/data.module';
import { UsersModule } from '../users/users.module';
import { RecipeAiService } from './recipe-ai.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [AiModule, AuthModule, DataModule, UsersModule],
  controllers: [RecipesController],
  providers: [RecipesService, RecipeAiService],
  exports: [RecipesService],
})
export class RecipesModule {}
