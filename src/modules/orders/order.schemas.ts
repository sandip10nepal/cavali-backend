/**
 * Order Validation Schemas
 */

import { z } from 'zod';

export const CreateOrderItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['food', 'drinks', 'hookah', 'chai', 'custom']),
  price: z.number().min(0),
  qty: z.number().int().min(1).default(1),
  emoji: z.string().optional(),
  note: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  table: z.string().min(1),
  name: z.string().optional().default('Guest'),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(CreateOrderItemSchema).optional().default([]),
  food: z.array(z.any()).optional().default([]),
  drinks: z.array(z.any()).optional().default([]),
  hookahs: z.array(z.any()).optional().default([]),
  total: z.number().min(0),
  taxExempt: z.boolean().optional().default(false),
  discountAmount: z.number().min(0).optional().default(0),
  tipAmount: z.number().min(0).optional().default(0),
  paymentStatus: z.enum(['unpaid', 'paid', 'partially_paid', 'refunded']).optional().default('unpaid'),
  paymentMethod: z.enum(['CASH', 'SQUARE', 'CARD', 'TAB']).optional().default('CASH'),
});

export const FulfillOrderSchema = z.object({
  orderId: z.string().min(1),
  department: z.enum(['food', 'drinks', 'hookah']).optional(),
});
