import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PricingConfigData } from '../standard-objects/pricing-config.workspace-entity';
import { IntakePayload } from '../dtos/intake-payload.dto';

describe('PricingService', () => {
  let service: PricingService;

  const defaultPricingConfig: PricingConfigData = {
    baseResidentialPerSqFt: 0.12,
    baseResidentialMinimum: 180,
    deepCleanMultiplier: 1.5,
    moveInOutMultiplier: 1.75,
    airbnbTurnoverFlat: {
      '1': 110,
      '2': 140,
      '3': 180,
      '4+': 220,
    },
    commercialPerSqFt: 0.08,
    frequencyDiscount: {
      ONE_TIME: 0,
      WEEKLY: 0.15,
      BI_WEEKLY: 0.1,
      MONTHLY: 0.05,
    },
    addOns: {
      inside_fridge: { label: 'Inside fridge', price: 30 },
      inside_oven: { label: 'Inside oven', price: 30 },
      inside_cabinets: { label: 'Inside cabinets', price: 60 },
      laundry: { label: 'Laundry (1 load)', price: 25 },
      windows_interior: { label: 'Interior windows', price: 50 },
      baseboards: { label: 'Baseboards', price: 40 },
    },
    taxRate: 0.055,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('buildDefaultLineItems', () => {
    it('should build line items for residential with square feet', () => {
      const payload: IntakePayload = {
        name: 'John Doe',
        email: 'john@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1500,
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);

      expect(lineItems.length).toBeGreaterThan(0);
      expect(lineItems[0].kind).toBe('BASE');
      expect(lineItems[0].description).toBe('Residential Cleaning');
      expect(lineItems[0].total).toBeGreaterThanOrEqual(180); // minimum
    });

    it('should apply frequency discount', () => {
      const payload: IntakePayload = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1000,
        frequency: 'BI_WEEKLY',
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);

      const hasDiscount = lineItems.some((item) => item.kind === 'DISCOUNT');
      expect(hasDiscount).toBe(true);

      const discount = lineItems.find((item) => item.kind === 'DISCOUNT');
      expect(discount?.total).toBeLessThan(0);
    });

    it('should add add-ons', () => {
      const payload: IntakePayload = {
        name: 'Bob Smith',
        email: 'bob@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 800,
        addOns: ['inside_fridge', 'inside_oven'],
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);

      const addOns = lineItems.filter((item) => item.kind === 'ADD_ON');
      expect(addOns.length).toBe(2);
      expect(addOns[0].unitPrice).toBe(30);
      expect(addOns[1].unitPrice).toBe(30);
    });

    it('should calculate tax', () => {
      const payload: IntakePayload = {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1000,
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);

      const taxItem = lineItems.find((item) => item.kind === 'TAX');
      expect(taxItem).toBeDefined();
      expect(taxItem?.total).toBeGreaterThan(0);
    });

    it('should respect minimum price for residential', () => {
      const payload: IntakePayload = {
        name: 'Small Home',
        email: 'small@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 100, // very small, should hit minimum
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);

      const baseItem = lineItems[0];
      expect(baseItem.total).toBeGreaterThanOrEqual(180); // minimum
    });

    it('should calculate deep clean multiplier', () => {
      const payload: IntakePayload = {
        name: 'Deep Clean',
        email: 'deep@example.com',
        serviceType: 'DEEP_CLEAN',
        squareFeet: 1000,
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);
      const baseItem = lineItems[0];

      const expectedBase = 1000 * 0.12 * 1.5; // squareFeet * perSqFt * multiplier
      expect(baseItem.total).toBeCloseTo(expectedBase, 1);
    });

    it('should calculate airbnb turnover by bedrooms', () => {
      const payloadWith2Br: IntakePayload = {
        name: 'Airbnb',
        email: 'airbnb@example.com',
        serviceType: 'AIRBNB_TURNOVER',
        bedrooms: 2,
      };

      const lineItems = service.buildDefaultLineItems(payloadWith2Br, defaultPricingConfig);
      const baseItem = lineItems[0];

      expect(baseItem.total).toBe(140); // 2-bedroom flat rate
    });

    it('should calculate commercial pricing', () => {
      const payload: IntakePayload = {
        name: 'Commercial',
        email: 'commercial@example.com',
        serviceType: 'COMMERCIAL',
        squareFeet: 5000,
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);
      const baseItem = lineItems[0];

      const expected = 5000 * 0.08; // commercialPerSqFt
      expect(baseItem.total).toBeCloseTo(expected, 1);
    });
  });

  describe('computeTotals', () => {
    it('should correctly compute all totals', () => {
      const payload: IntakePayload = {
        name: 'Test',
        email: 'test@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1000,
        frequency: 'BI_WEEKLY',
        addOns: ['inside_fridge'],
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);
      const totals = service.computeTotals(lineItems);

      expect(totals.subtotal).toBeGreaterThan(0);
      expect(totals.discountTotal).toBeGreaterThan(0); // bi-weekly discount
      expect(totals.taxTotal).toBeGreaterThan(0);
      expect(totals.total).toBeGreaterThan(0);
      expect(totals.total).toBeLessThan(totals.subtotal); // due to discount
    });

    it('should handle zero discount and tax', () => {
      const payload: IntakePayload = {
        name: 'No Discount',
        email: 'nodiscount@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1000,
        frequency: 'ONE_TIME',
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);
      const totals = service.computeTotals(lineItems);

      expect(totals.discountTotal).toBe(0);
      expect(totals.taxTotal).toBeGreaterThan(0);
    });

    it('should round values to 2 decimals', () => {
      const payload: IntakePayload = {
        name: 'Rounding',
        email: 'rounding@example.com',
        serviceType: 'RESIDENTIAL',
        squareFeet: 1234, // odd number to trigger rounding
      };

      const lineItems = service.buildDefaultLineItems(payload, defaultPricingConfig);
      const totals = service.computeTotals(lineItems);

      expect(totals.subtotal % 0.01).toBeLessThan(0.01);
      expect(totals.total % 0.01).toBeLessThan(0.01);
    });
  });
});
