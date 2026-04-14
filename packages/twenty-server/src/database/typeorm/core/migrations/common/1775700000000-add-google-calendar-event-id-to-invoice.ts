import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGoogleCalendarEventIdToInvoice1775700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'invoice',
      new TableColumn({
        name: 'googleCalendarEventId',
        type: 'varchar',
        isNullable: true,
        comment: 'External Google Calendar event ID for linking to calendar events',
      }),
    );

    // Create index for faster lookups
    await queryRunner.query(
      `CREATE INDEX IDX_invoice_googleCalendarEventId ON invoice(googleCalendarEventId)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IDX_invoice_googleCalendarEventId`,
    );
    await queryRunner.dropColumn('invoice', 'googleCalendarEventId');
  }
}
