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
  cleaningId: string | null | undefined;

  @Field({ nullable: true })
  propertyId: string | null | undefined;

  @Field({ nullable: true })
  propertyName: string | null | undefined;

  @Field({ nullable: true })
  propertyAddress: string | null | undefined;

  @Field({ nullable: true })
  guestNote: string | null | undefined;

  @Field({ nullable: true })
  assignedStaffName: string | null | undefined;

  @Field({ nullable: true })
  status: string | null | undefined;

  @Field({ nullable: true })
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
