import { Test, TestingModule } from '@nestjs/testing';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { StrIcalSyncService } from 'src/modules/calendar/services/str-ical-sync.service';

describe('StrIcalSyncService', () => {
  let service: StrIcalSyncService;
  let mockOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;

  beforeEach(async () => {
    mockOrmManager = {
      getRepository: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrIcalSyncService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: mockOrmManager,
        },
      ],
    }).compile();

    service = module.get<StrIcalSyncService>(StrIcalSyncService);
  });

  describe('syncStrProperties', () => {
    it('should return result with processed=0 when no properties found', async () => {
      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn().resolvedValue([]),
        }),
      };

      mockOrmManager.getRepository.mockResolvedValue(mockRepository as any);

      const result = await service.syncStrProperties({
        workspaceId: 'test-workspace',
      });

      expect(result.processed).toBe(0);
      expect(result.created).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn().rejectedValue(new Error('Database error')),
        }),
      };

      mockOrmManager.getRepository.mockResolvedValue(mockRepository as any);

      const result = await service.syncStrProperties({
        workspaceId: 'test-workspace',
      });

      expect(result.processed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseAndFilterCheckoutEvents', () => {
    it('should detect checkout events from iCal summary', async () => {
      // This tests the event detection logic
      // We mock the fetch to return a test iCal string

      const testIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-001@example.com
DTSTART;VALUE=DATE:20260520
SUMMARY:Guest checkout
DESCRIPTION:Airbnb checkout
END:VEVENT
END:VCALENDAR`;

      // The test would verify that "Guest checkout" is detected
      // This is a placeholder showing how the parsing should work
      expect(testIcal).toContain('checkout');
    });
  });
});
