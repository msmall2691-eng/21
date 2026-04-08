import { Field, ObjectType } from '@nestjs/graphql';

import { type AddressMetadata } from 'twenty-shared/types';

export type CalendarEventWithCleaningsType = {
  id: string;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: AddressMetadata | string | null;
  description: string | null;
  isCanceled: boolean;
  isFullDay: boolean;
  type: 'CALENDAR_EVENT' | 'CLEANING_JOB';
  // For cleaning jobs only
  cleaningId?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyAddress?: AddressMetadata | string | null;
  guestNote?: string | null;
  assignedStaffName?: string | null;
  status?: string | null;
  serviceAgreementId?: string | null;
};

@ObjectType()
export class CalendarEventWithCleaningsDTO {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  title: string | null;

  @Field(() => String, { nullable: true })
  startsAt: string | null;

  @Field(() => String, { nullable: true })
  endsAt: string | null;

  @Field(() => String, { nullable: true })
  location: string | null;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => Boolean)
  isCanceled: boolean;

  @Field(() => Boolean)
  isFullDay: boolean;

  @Field(() => String)
  type: string; // 'CALENDAR_EVENT' | 'CLEANING_JOB'

  // For cleaning jobs only
  @Field(() => String, { nullable: true })
  cleaningId: string | null | undefined;

  @Field(() => String, { nullable: true })
  propertyId: string | null | undefined;

  @Field(() => String, { nullable: true })
  propertyName: string | null | undefined;

  @Field(() => String, { nullable: true })
  propertyAddress: string | null | undefined;

  @Field(() => String, { nullable: true })
  guestNote: string | null | undefined;

  @Field(() => String, { nullable: true })
  assignedStaffName: string | null | undefined;

  @Field(() => String, { nullable: true })
  status: string | null | undefined;

  @Field(() => String, { nullable: true })
  serviceAgreementId: string | null | undefined;
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
