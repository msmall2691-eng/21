import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ScheduleEmailOutputDTO {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  jobId?: string;

  @Field(() => String, { nullable: true })
  error?: string;
}
