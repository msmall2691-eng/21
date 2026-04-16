import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsISO8601, IsOptional } from 'class-validator';

@InputType()
export class ScheduleEmailInput {
  @Field(() => String)
  @IsNotEmpty()
  connectedAccountId: string;

  @Field(() => String)
  @IsEmail()
  to: string;

  @Field(() => String)
  @IsNotEmpty()
  subject: string;

  @Field(() => String)
  @IsNotEmpty()
  body: string;

  @Field(() => String)
  @IsISO8601()
  scheduledAt: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  inReplyTo?: string;
}
