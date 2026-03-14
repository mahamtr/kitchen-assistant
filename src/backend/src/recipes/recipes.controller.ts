import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { RecipesService } from './recipes.service';

@Controller('recipes')
@UseGuards(SupabaseAuthGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async listRecipes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope')
    scope: 'weekly_planned' | 'favorites' | 'history' = 'weekly_planned',
    @Query('search') search = '',
  ) {
    return this.recipesService.listRecipes(user, scope, search);
  }

  @Get('generations/active')
  async getActiveGeneration(@CurrentUser() user: AuthenticatedUser) {
    return this.recipesService.getActiveGeneration(user);
  }

  @Post('generations')
  async startGeneration(
    @CurrentUser() user: AuthenticatedUser,
    @Body('userMessage') userMessage?: string,
  ) {
    return this.recipesService.startGeneration(user, userMessage);
  }

  @Get('generations/:generationId')
  async getGeneration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('generationId') generationId: string,
  ) {
    return this.recipesService.getGeneration(user, generationId);
  }

  @Get('generations/:generationId/revisions')
  async getGenerationRevisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('generationId') generationId: string,
  ) {
    return this.recipesService.getGenerationRevisions(user, generationId);
  }

  @Post('generations/:generationId/revisions')
  async createGenerationRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('generationId') generationId: string,
    @Body('userMessage') userMessage: string,
  ) {
    return this.recipesService.createGenerationRevision(
      user,
      generationId,
      userMessage,
    );
  }

  @Post('generations/:generationId/revisions/:revisionId/accept')
  async acceptGeneration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('generationId') generationId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.recipesService.acceptGeneration(user, generationId, revisionId);
  }

  @Get(':recipeId')
  async getRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId') recipeId: string,
  ) {
    return this.recipesService.getRecipe(user, recipeId);
  }

  @Post(':recipeId/favorite')
  async favoriteRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId') recipeId: string,
  ) {
    return this.recipesService.setFavorite(user, recipeId, true);
  }

  @Delete(':recipeId/favorite')
  async unfavoriteRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId') recipeId: string,
  ) {
    return this.recipesService.setFavorite(user, recipeId, false);
  }

  @Post(':recipeId/cooked')
  async cookRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId') recipeId: string,
  ) {
    return this.recipesService.cookRecipe(user, recipeId);
  }

  @Post(':recipeId/rate')
  async rateRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId') recipeId: string,
    @Body('rating') rating: number,
    @Body('feedback') feedback?: string,
  ) {
    return this.recipesService.rateRecipe(user, recipeId, rating, feedback);
  }
}
