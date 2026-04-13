import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';

export type AddOnConfig = {
  label: string;
  price: number;
};

export type FrequencyDiscountConfig = {
  ONE_TIME: number;
  WEEKLY: number;
  BI_WEEKLY: number;
  MONTHLY: number;
};

export type AirbnbTurnoverFlat = {
  [key: string]: number; // "1", "2", "3", "4+"
};

export type PricingConfigData = {
  baseResidentialPerSqFt: number;
  baseResidentialMinimum: number;
  deepCleanMultiplier: number;
  moveInOutMultiplier: number;
  airbnbTurnoverFlat: AirbnbTurnoverFlat;
  commercialPerSqFt: number;
  frequencyDiscount: FrequencyDiscountConfig;
  addOns: Record<string, AddOnConfig>;
  taxRate: number;
};

export class PricingConfigWorkspaceEntity extends BaseWorkspaceEntity {
  name: string; // singular config name, e.g. "default"
  data: PricingConfigData;
  isActive: boolean; // currently active pricing config
  description: string | null;
}
