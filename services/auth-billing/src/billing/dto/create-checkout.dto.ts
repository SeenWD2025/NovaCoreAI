import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['basic', 'pro'])
  tier: 'basic' | 'pro';
}
