import { Test, TestingModule } from '@nestjs/testing';
import { LeadExtractionService } from './lead-extraction.service';

describe('LeadExtractionService', () => {
  let service: LeadExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeadExtractionService],
    }).compile();

    service = module.get<LeadExtractionService>(LeadExtractionService);
  });

  describe('isCleaningRequest', () => {
    it('should detect residential cleaning request', () => {
      const result = service.extractLeadData(
        'jane@example.com',
        'Jane Doe',
        'Need house cleaning',
        'Hi, I need my house cleaned this week. Its a 2 bedroom house.',
      );

      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should detect deep clean request', () => {
      const result = service.extractLeadData(
        'john@example.com',
        'John Smith',
        'Deep clean needed',
        'Looking for a deep cleaning service for my apartment. 1500 sq ft.',
      );

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.serviceType).toContain('DEEP_CLEAN');
    });

    it('should detect move-in/out cleaning', () => {
      const result = service.extractLeadData(
        'alice@example.com',
        'Alice',
        'Move out cleaning',
        'I need move-out cleaning service for my apartment on May 15th.',
      );

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.serviceType).toContain('MOVE_IN_OUT');
    });

    it('should detect Airbnb turnover cleaning', () => {
      const result = service.extractLeadData(
        'bob@example.com',
        'Bob',
        'Airbnb turnover',
        'Looking for cleaning service for my Airbnb property. 3 bedroom turnover cleaning needed weekly.',
      );

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.serviceType).toContain('AIRBNB_TURNOVER');
    });

    it('should not create opportunity for non-cleaning email', () => {
      const result = service.extractLeadData(
        'marketing@company.com',
        'Marketing',
        'Software sales pitch',
        'Hi, we have a great CRM product for you. Let me know if you are interested.',
      );

      expect(result.confidence).toBe(0);
    });
  });

  describe('extractServiceType', () => {
    it('should identify residential cleaning', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Need cleaning',
        'I need residential cleaning for my home',
      );

      expect(result.serviceType).toBe('RESIDENTIAL');
    });

    it('should identify commercial cleaning', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Office cleaning',
        'We need commercial office cleaning service twice a week.',
      );

      expect(result.serviceType).toBe('COMMERCIAL');
    });
  });

  describe('extractFrequency', () => {
    it('should detect weekly frequency', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Weekly cleaning',
        'I need cleaning service every week',
      );

      expect(result.requestedFrequency).toBe('WEEKLY');
    });

    it('should detect bi-weekly frequency', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Biweekly',
        'Looking for bi-weekly cleaning',
      );

      expect(result.requestedFrequency).toBe('BI_WEEKLY');
    });

    it('should detect monthly frequency', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Monthly',
        'Once a month cleaning service',
      );

      expect(result.requestedFrequency).toBe('MONTHLY');
    });

    it('should detect one-time frequency', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'One time',
        'I need a one-time cleaning service',
      );

      expect(result.requestedFrequency).toBe('ONE_TIME');
    });
  });

  describe('extractPhoneNumber', () => {
    it('should extract formatted phone number', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'Please call me at (207) 555-1212 to discuss details.',
      );

      expect(result.phone).toBe('2075551212');
    });

    it('should extract phone with dashes', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'My number is 207-555-1212',
      );

      expect(result.phone).toBe('2075551212');
    });

    it('should extract phone with +1', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'Call +1 207 555 1212',
      );

      expect(result.phone).toBe('2075551212');
    });

    it('should return null for no phone', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'Please email me with your availability',
      );

      expect(result.phone).toBeNull();
    });
  });

  describe('extractPropertyDetails', () => {
    it('should extract bedrooms, bathrooms, and square feet', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'I have a 3 bedroom, 2 bathroom house with 2000 sq ft.',
      );

      expect(result.bedrooms).toBe(3);
      expect(result.bathrooms).toBe(2);
      expect(result.estimatedSquareFeet).toBe(2000);
    });

    it('should handle fractional bathrooms', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'My place has 2 bedrooms and 1.5 bathrooms.',
      );

      expect(result.bedrooms).toBe(2);
      expect(result.bathrooms).toBe(1.5);
    });

    it('should handle variations like "bed" and "bath"', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        '3 bed, 2 bath, 1500 sqft',
      );

      expect(result.bedrooms).toBe(3);
      expect(result.bathrooms).toBe(2);
      expect(result.estimatedSquareFeet).toBe(1500);
    });

    it('should handle missing property details', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'I need my house cleaned but dont have specs',
      );

      expect(result.bedrooms).toBeNull();
      expect(result.bathrooms).toBeNull();
      expect(result.estimatedSquareFeet).toBeNull();
    });
  });

  describe('extractAddress', () => {
    it('should extract street address', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'Please clean my place at 123 Main Street',
      );

      expect(result.address).toContain('123 Main');
    });

    it('should extract abbreviated address', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'Address: 456 Oak Ave',
      );

      expect(result.address).toContain('456 Oak');
    });

    it('should return null for no address', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'I need cleaning service',
      );

      expect(result.address).toBeNull();
    });
  });

  describe('confidence scoring', () => {
    it('should give high confidence for complete lead info', () => {
      const result = service.extractLeadData(
        'jane@example.com',
        'Jane Doe',
        'Need residential cleaning',
        `I need cleaning service for my home.
         Address: 123 Main Street
         3 bedrooms, 2 bathrooms, 1800 sq ft
         Weekly cleaning preferred
         Call me at (207) 555-1212`,
      );

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should give low confidence for minimal info', () => {
      const result = service.extractLeadData(
        'test@example.com',
        'Test',
        'Cleaning',
        'I might need cleaning someday',
      );

      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
