import { IsEnum, IsArray, ValidateNested, IsOptional, IsString, isString } from 'class-validator';
import { Type } from 'class-transformer';

class EventItemDto {
    @IsOptional()
    @IsString()
    inventoryItemId?: string | null;

    @IsString()
    name: string;

    @IsOptional()
    quantity?: { value: number | null; unit: string | null };
}

export class CreateInventoryEventDto {
    @IsString()
    UserId: string;

    @IsEnum(['ADD', 'USE', 'DISCARD', 'ADJUST'])
    type: 'ADD' | 'USE' | 'DISCARD' | 'ADJUST';

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EventItemDto)
    items: EventItemDto[];

    @IsOptional()
    @IsEnum(['home', 'chat', 'grocery_list'])
    source?: 'home' | 'chat' | 'grocery_list';

    @IsOptional()
    metadata?: any;
}
