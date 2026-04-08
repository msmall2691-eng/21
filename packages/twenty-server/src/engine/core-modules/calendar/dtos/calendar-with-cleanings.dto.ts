import { Field, ObjectType } from '@nestjs/graphql';

export type CalendarEventWithCleaningsType = {
  id: string;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  isCanceled: boolean;
  isFullDay: boolean;
  type: 'CALENDAR_EVENT' | 'CLEANING_JOB';
  // For cleaning jobs only
  cleaningId?: string;
  propertyId?: string;
  propertyName?: string;
  propertyAddress?: string;
  guestNote?: string;
  assignedStaffName?: string;
  status?: string;
  serviceAgreementId?: string;
};

@ObjectType()
export class CalendarEventWithCleaningsDTO {
  @Field()
  id: string;

  @Field({ nullable: true })
  title: string | null;

  @Field({ nullable: true })
  startsAt: string | null;

  @Field({ nullable: true })
  endsAt: string | null;

  @Field({ nullable: true })
  location: string | null;

  @Field({ nullable: true })
  description: string | null;

  @Field()
  isCanceled: boolean;

  @Field()
  isFullDay: boolean;

  @Field()
  type: string; // 'CALENDAR_EVENT' | 'CLEANING_JOB'

  // For cleaning jobs only
  @Field({ nullable: true })
  cleaningId?: string;

  @Field({ nullable: true })
  propertyId?: string;

  @Field({ nullable: true })
  propertyName?: string;

  @Field({ nullable: true })
  propertyAddress?: string;

  @Field({ nullable: true })
  guestNote?: string;

  @Field({ nullable: true })
  assignedStaffName?: string;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  serviceAgreementId?: string;
}

@ObjectType()
export class CalendarWithCleaningsResponseDTO {
  @Field(() => [CalendarEventWithCleaningsDTO])
  events: CalendarEventWithCleaningsDTO[];

  @Field()
  totalCount: number;

  @Field()
  startDate: string;

  @Field()
  endDate: string;
}
