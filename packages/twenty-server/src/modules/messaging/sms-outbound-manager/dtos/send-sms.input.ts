import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsMobilePhone, IsOptional } from 'class-validator';

@InputType()
export class SendSmsInput {
  @Field(() => String)
  @IsMobilePhone()
  to: string;

  @Field(() => String)
  @IsNotEmpty()
  body: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  inReplyTo?: string;
}
