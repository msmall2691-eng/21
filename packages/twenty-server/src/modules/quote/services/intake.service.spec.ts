import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IntakeService } from './intake.service';

describe('IntakeService', () => {
  let service: IntakeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntakeService],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
  });

  describe('validateAndNormalizePayload', () => {
    it('should accept valid minimal payload', () => {
      const payload = {
        name: 'John Doe',
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
      };

      const result = service.validateAndNormalizePayload(payload);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should reject missing name', () => {
      const payload = {
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
      };

      const result = service.validateAndNormalizePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should reject invalid email format', () => {
      const payload = {
        name: 'John Doe',
        email: 'not-an-email',
        serviceType: 'RESIDENTIAL',
      };

      const result = service.validateAndNormalizePayload(payload);

      expect(result.valid).toBe(false);
    });

    it('should accept phone number instead of email', () => {
      const payload = {
        name: 'Jane Smith',
        phone: '+1 (207) 555-1212',
        serviceType: 'RESIDENTIAL',
      };

      const result = service.validateAndNormalizePayload(payload);

      expect(result.valid).toBe(true);
    });

    it('should allow optional fields', () => {
      const payload = {
        name: 'John Doe',
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1500,
        bedrooms: 3,
        bathrooms: 2.5,
        frequency: 'BI_WEEKLY',
        addOns: ['inside_fridge', 'inside_oven'],
        notes: 'Prefer weekday mornings',
      };

      const result = service.validateAndNormalizePayload(payload);

      expect(result.valid).toBe(true);
      expect(result.payload?.squareFeet).toBe(1500);
      expect(result.payload?.bedrooms).toBe(3);
    });

    it('should reject extra fields gracefully (passthrough)', () => {
      const payload = {
        name: 'John Doe',
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
        unknownField: 'should be ignored',
      };

      const result = service.validateAndNormalizePayload(payload);

      // Zod passthrough allows extra fields, so this should be valid
      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeContact', () => {
    it('should normalize email to lowercase', () => {
      const payload = {
        name: 'John Doe',
        email: 'John.Doe@Example.COM',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.email).toBe('john.doe@example.com');
    });

    it('should normalize US phone number to E.164', () => {
      const payload = {
        name: 'Jane Smith',
        phone: '(207) 555-1212',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.phone).toBe('+12075551212');
    });

    it('should handle phone with +1 prefix', () => {
      const payload = {
        name: 'Jane Smith',
        phone: '+1 207 555 1212',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.phone).toBe('+12075551212');
    });

    it('should reject invalid phone silently and set to null', () => {
      const payload = {
        name: 'Jane Smith',
        phone: 'not-a-phone-number',
        email: 'jane@example.com',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.phone).toBeNull();
      expect(contact.email).toBe('jane@example.com');
    });

    it('should throw if neither email nor phone provided', () => {
      const payload = {
        name: 'John Doe',
        serviceType: 'RESIDENTIAL',
      };

      expect(() => service.normalizeContact(payload)).toThrow(
        BadRequestException,
      );
    });

    it('should trim whitespace from name', () => {
      const payload = {
        name: '  John Doe  ',
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.name).toBe('John Doe');
    });

    it('should handle both email and phone', () => {
      const payload = {
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        phone: '(207) 555-1212',
        serviceType: 'RESIDENTIAL',
      };

      const contact = service.normalizeContact(payload);

      expect(contact.email).toBe('john@example.com');
      expect(contact.phone).toBe('+12075551212');
    });
  });

  describe('isPersonalEmail', () => {
    it('should identify gmail as personal', () => {
      expect(service.isPersonalEmail('user@gmail.com')).toBe(true);
    });

    it('should identify yahoo as personal', () => {
      expect(service.isPersonalEmail('user@yahoo.com')).toBe(true);
    });

    it('should identify outlook as personal', () => {
      expect(service.isPersonalEmail('user@outlook.com')).toBe(true);
    });

    it('should identify custom domain as corporate', () => {
      expect(service.isPersonalEmail('user@acmecorp.com')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service.isPersonalEmail('user@Gmail.COM')).toBe(true);
    });
  });
});
