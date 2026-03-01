import { IsNotEmpty, IsOptional, IsString, IsEnum, ValidateNested, IsNumber, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class QuantityDto {
    @IsOptional()
    @IsNumber()
    value: number | null;

    @IsOptional()
    @IsString()
    unit: string | null;
}

export class CreateInventoryItemDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsNotEmpty()
    @IsEnum(['fridge', 'pantry'])
    location: 'fridge' | 'pantry';

    @IsOptional()
    @ValidateNested()
    @Type(() => QuantityDto)
    quantity?: QuantityDto;

    @IsOptional()
    @IsEnum(['fresh', 'use_soon', 'expired', 'unknown'])
    status?: 'fresh' | 'use_soon' | 'expired' | 'unknown';

    @IsOptional()
    @IsObject()
    dates?: any;

    @IsOptional()
    @IsObject()
    freshness?: any;
}
