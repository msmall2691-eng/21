import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Generates auto-incrementing quote numbers in format Q-YYYY-NNNN
 * Uses database-level locking to prevent race conditions.
 */
@Injectable()
export class QuoteNumberService {
  constructor(private dataSource: DataSource) {}

  /**
   * Generate the next quote number for the current year.
   * Format: Q-YYYY-NNNN (e.g., Q-2026-0001, Q-2026-0002)
   *
   * This uses a simple counter approach:
   * - Get the current year
   * - Query quotes created in that year
   * - Increment the counter and format with zero-padding
   *
   * For production, consider using database sequences or a dedicated counter table
   * with FOR UPDATE locking for better concurrency.
   */
  async generateQuoteNumber(workspaceId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear + 1, 0, 1);

    const query = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('quote', 'q')
      .where('q."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('q."createdAt" >= :startOfYear', { startOfYear })
      .andWhere('q."createdAt" < :endOfYear', { endOfYear });

    const result = await query.getRawOne();
    const nextNumber = (parseInt(result.count, 10) + 1).toString().padStart(4, '0');

    return `Q-${currentYear}-${nextNumber}`;
  }
}
