import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SendSmsOutputDTO {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  messageSid?: string;

  @Field(() => String, { nullable: true })
  error?: string;
}
