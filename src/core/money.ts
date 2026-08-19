/**
 * Money Value Object
 *
 * Represents monetary values as integer minor units (cents) to avoid
 * floating-point precision issues.
 */

export interface MoneyJSON {
  amount_cents: number;
  currency: string;
  formatted: string;
}

export class Money {
  public readonly amountCents: number;
  public readonly currency: string;

  constructor(amountCents: number, currency = 'USD') {
    if (!Number.isInteger(amountCents)) {
      throw new Error(`Money amount must be an integer (cents). Received: ${amountCents}`);
    }
    this.amountCents = amountCents;
    this.currency = currency.toUpperCase();
  }

  /**
   * Create Money instance from dollar decimal number (e.g. 12.50 -> 1250)
   */
  static fromDollars(dollars: number, currency = 'USD'): Money {
    const cents = Math.round(Number(dollars || 0) * 100);
    return new Money(cents, currency);
  }

  /**
   * Create Money instance directly from cents
   */
  static fromCents(cents: number, currency = 'USD'): Money {
    return new Money(Math.round(Number(cents || 0)), currency);
  }

  /**
   * Zero money helper
   */
  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  /**
   * Add another Money instance
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountCents + other.amountCents, this.currency);
  }

  /**
   * Subtract another Money instance
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountCents - other.amountCents, this.currency);
  }

  /**
   * Multiply by a scalar (e.g. quantity or percentage factor)
   */
  multiply(factor: number): Money {
    return new Money(Math.round(this.amountCents * factor), this.currency);
  }

  /**
   * Calculate percentage (e.g., tax rate 0.0825)
   */
  percentage(rate: number): Money {
    return new Money(Math.round(this.amountCents * rate), this.currency);
  }

  /**
   * Convert cents to decimal dollar number
   */
  toDollars(): number {
    return Number((this.amountCents / 100).toFixed(2));
  }

  /**
   * Formatted currency string (e.g. "$12.50")
   */
  format(): string {
    const dollars = (this.amountCents / 100).toFixed(2);
    return `$${dollars}`;
  }

  toJSON(): MoneyJSON {
    return {
      amount_cents: this.amountCents,
      currency: this.currency,
      formatted: this.format(),
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
