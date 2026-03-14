import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { DataModule } from './data/data.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PlannerModule } from './planner/planner.module';
import { GroceryModule } from './grocery/grocery.module';
import { InventoryModule } from './inventory/inventory.module';
import { RecipesModule } from './recipes/recipes.module';
import { HomeModule } from './home/home.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    DataModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    PlannerModule,
    GroceryModule,
    InventoryModule,
    RecipesModule,
    HomeModule,
  ],
})
export class AppModule {}
