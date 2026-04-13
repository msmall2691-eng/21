import { Injectable } from '@nestjs/common';
import {
  PricingConfigData,
  FrequencyDiscountConfig,
  AirbnbTurnoverFlat,
} from '../standard-objects/pricing-config.workspace-entity';
import {
  QuoteLineItem,
  ServiceType,
  FrequencyType,
} from '../standard-objects/quote.workspace-entity';
import { IntakePayload } from '../dtos/intake-payload.dto';

export interface LineItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  kind: 'BASE' | 'ADD_ON' | 'DISCOUNT' | 'TAX' | 'CUSTOM';
}

@Injectable()
export class PricingService {
  /**
   * Build default line items based on intake payload and pricing configuration.
   * Returns an ordered list: BASE → ADD_ONs → DISCOUNT → TAX
   */
  buildDefaultLineItems(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): QuoteLineItem[] {
    const lineItems: QuoteLineItem[] = [];
    let id = 1;

    // 1. Calculate BASE item
    const basePrice = this.calculateBasePrice(payload, pricingConfig);
    if (basePrice > 0) {
      lineItems.push({
        id: `line-${id++}`,
        description: this.getServiceTypeLabel(payload.serviceType as ServiceType),
        quantity: 1,
        unitPrice: this.round(basePrice),
        total: this.round(basePrice),
        kind: 'BASE',
      });
    }

    // 2. Add ADD_ON items
    if (payload.addOns && payload.addOns.length > 0) {
      let addOnTotal = 0;
      payload.addOns.forEach((addOnKey) => {
        const addOn = pricingConfig.addOns[addOnKey];
        if (addOn) {
          const price = this.round(addOn.price);
          lineItems.push({
            id: `line-${id++}`,
            description: addOn.label,
            quantity: 1,
            unitPrice: price,
            total: price,
            kind: 'ADD_ON',
          });
          addOnTotal += price;
        }
      });
    }

    // 3. Calculate and apply DISCOUNT (frequency-based)
    const subtotalBeforeDiscount = lineItems.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const discountRate =
      pricingConfig.frequencyDiscount[
        (payload.frequency?.toUpperCase() || 'ONE_TIME') as keyof FrequencyDiscountConfig
      ] || 0;

    if (discountRate > 0) {
      const discountAmount = this.round(subtotalBeforeDiscount * discountRate);
      if (discountAmount > 0) {
        lineItems.push({
          id: `line-${id++}`,
          description: `${(discountRate * 100).toFixed(0)}% frequency discount`,
          quantity: 1,
          unitPrice: -discountAmount,
          total: -discountAmount,
          kind: 'DISCOUNT',
        });
      }
    }

    // 4. Calculate subtotal after discounts
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    // 5. Calculate and add TAX
    const taxAmount = this.round(subtotal * pricingConfig.taxRate);
    if (taxAmount > 0) {
      lineItems.push({
        id: `line-${id++}`,
        description: `Tax (${(pricingConfig.taxRate * 100).toFixed(2)}%)`,
        quantity: 1,
        unitPrice: taxAmount,
        total: taxAmount,
        kind: 'TAX',
      });
    }

    return lineItems;
  }

  /**
   * Calculate the base service price based on service type and payload.
   */
  private calculateBasePrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    const serviceType = (payload.serviceType || '').toUpperCase() as ServiceType;

    switch (serviceType) {
      case 'RESIDENTIAL':
        return this.calculateResidentialPrice(payload, pricingConfig);
      case 'DEEP_CLEAN':
        return this.calculateDeepCleanPrice(payload, pricingConfig);
      case 'MOVE_IN_OUT':
        return this.calculateMoveInOutPrice(payload, pricingConfig);
      case 'AIRBNB_TURNOVER':
        return this.calculateAirbnbTurnoverPrice(payload, pricingConfig);
      case 'COMMERCIAL':
        return this.calculateCommercialPrice(payload, pricingConfig);
      default:
        // OTHER or unknown: return 0, let user set custom price
        return 0;
    }
  }

  private calculateResidentialPrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    if (!payload.squareFeet) return pricingConfig.baseResidentialMinimum;
    const price = payload.squareFeet * pricingConfig.baseResidentialPerSqFt;
    return Math.max(price, pricingConfig.baseResidentialMinimum);
  }

  private calculateDeepCleanPrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    const basePrice = this.calculateResidentialPrice(payload, pricingConfig);
    return basePrice * pricingConfig.deepCleanMultiplier;
  }

  private calculateMoveInOutPrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    const basePrice = this.calculateResidentialPrice(payload, pricingConfig);
    return basePrice * pricingConfig.moveInOutMultiplier;
  }

  private calculateAirbnbTurnoverPrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    const bedrooms = payload.bedrooms || 1;
    const key = bedrooms >= 4 ? '4+' : bedrooms.toString();
    return pricingConfig.airbnbTurnoverFlat[key] || 0;
  }

  private calculateCommercialPrice(
    payload: IntakePayload,
    pricingConfig: PricingConfigData,
  ): number {
    if (!payload.squareFeet) return 0;
    return payload.squareFeet * pricingConfig.commercialPerSqFt;
  }

  private getServiceTypeLabel(serviceType: ServiceType): string {
    const labels: Record<ServiceType, string> = {
      RESIDENTIAL: 'Residential Cleaning',
      DEEP_CLEAN: 'Deep Clean',
      MOVE_IN_OUT: 'Move In/Out Cleaning',
      AIRBNB_TURNOVER: 'Airbnb Turnover',
      COMMERCIAL: 'Commercial Cleaning',
      OTHER: 'Custom Service',
    };
    return labels[serviceType] || 'Cleaning Service';
  }

  /**
   * Recompute totals from line items.
   */
  computeTotals(
    lineItems: QuoteLineItem[],
  ): {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
  } {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    lineItems.forEach((item) => {
      if (item.kind === 'DISCOUNT') {
        discountTotal += Math.abs(item.total); // make positive
      } else if (item.kind === 'TAX') {
        taxTotal += item.total;
      } else if (item.kind !== 'TAX') {
        subtotal += item.total;
      }
    });

    const total = subtotal - discountTotal + taxTotal;

    return {
      subtotal: this.round(subtotal),
      discountTotal: this.round(discountTotal),
      taxTotal: this.round(taxTotal),
      total: this.round(total),
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
