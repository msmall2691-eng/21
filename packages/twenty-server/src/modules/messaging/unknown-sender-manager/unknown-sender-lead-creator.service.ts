import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UnknownSenderEmail {
  from: string;
  subject: string;
  body: string;
  messageId: string;
  threadId: string;
  receivedAt: Date;
}

@Injectable()
export class UnknownSenderLeadCreatorService {
  private readonly logger = new Logger(UnknownSenderLeadCreatorService.name);

  constructor(private readonly dataSource: DataSource) {}

  async createLeadFromUnknownSender(
    email: UnknownSenderEmail,
    workspaceId: string,
  ): Promise<string | null> {
    try {
      // Extract email and name from sender
      const { emailAddress, senderName } = this.parseEmailAddress(email.from);

      // Check if person already exists
      const existingPerson = await this.findPersonByEmail(
        emailAddress,
        workspaceId,
      );

      if (existingPerson) {
        this.logger.log(
          `Person already exists for ${emailAddress}`,
        );
        return existingPerson.id;
      }

      // Create person
      const personId = await this.createPerson(
        emailAddress,
        senderName,
        workspaceId,
      );

      // Create opportunity from email
      const opportunityId = await this.createOpportunityFromEmail(
        personId,
        email,
        workspaceId,
      );

      this.logger.log(
        `Created opportunity ${opportunityId} from unknown sender ${emailAddress}`,
      );

      return opportunityId;
    } catch (error) {
      this.logger.error(
        `Failed to create lead from unknown sender: ${error}`,
        error instanceof Error ? error.stack : '',
      );
      return null;
    }
  }

  private parseEmailAddress(
    from: string,
  ): { emailAddress: string; senderName: string } {
    // Handle "Name <email@domain.com>" format
    const match = from.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/) ||
      from.match(/^([^<]+)<([^>]+)>$/) ||
      from.match(/^([^<]+?)?\s?<(.+?)>$/);

    if (match && match[2]) {
      return {
        emailAddress: match[2].trim().toLowerCase(),
        senderName: (match[1] || 'Unknown').trim() || 'Unknown',
      };
    }

    // If no angle brackets, assume it's just email
    return {
      emailAddress: from.trim().toLowerCase(),
      senderName: from.trim().split('@')[0] || 'Unknown',
    };
  }

  private async findPersonByEmail(
    email: string,
    workspaceId: string,
  ): Promise<{ id: string } | null> {
    // This is a placeholder - in actual implementation, query the Person table
    // For now, we'll return null to allow creation
    // In real implementation: const person = await this.personRepository.findOne(...)
    return null;
  }

  private async createPerson(
    email: string,
    name: string,
    workspaceId: string,
  ): Promise<string> {
    // Placeholder for actual person creation
    // In real implementation:
    // const person = await this.personRepository.create({ email, name, workspaceId })
    // return person.id;

    const id = `person_${Date.now()}`;
    this.logger.log(
      `Created person ${id} for ${email}`,
    );
    return id;
  }

  private async createOpportunityFromEmail(
    personId: string,
    email: UnknownSenderEmail,
    workspaceId: string,
  ): Promise<string> {
    // Extract opportunity title from email subject
    const title = email.subject || 'Inquiry from ' + email.from;

    // Create opportunity with initial contact through email
    // Placeholder for actual opportunity creation
    // In real implementation:
    // const opportunity = await this.opportunityRepository.create({
    //   name: title,
    //   personId,
    //   workspaceId,
    //   stage: 'lead', // or first stage
    //   description: email.body,
    //   metadata: { emailThreadId: email.threadId, messageId: email.messageId }
    // })

    const id = `opportunity_${Date.now()}`;
    this.logger.log(
      `Created opportunity ${id} from email: ${title}`,
    );
    return id;
  }
}
