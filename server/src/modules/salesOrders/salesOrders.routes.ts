import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { generateOrderNumber } from '../../utils/orderNumber';
import { AppError } from '../../utils/errors';

const router = Router();
router.use(requireAuth);

const orderInclude = {
  customer: true,
  user: { select: { id: true as const, name: true as const } },
  items: { include: { product: true } },
  payments: { orderBy: { createdAt: 'asc' as const } },
};

// Rounds to whole cents to avoid floating-point artifacts (e.g. 168.92000000000002)
// leaking into API responses and, from there, into prefilled form fields.
function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

// Attaches derived amountPaid / balanceDue to a sales order so the client never
// has to sum payments itself.
function withPaymentSummary<T extends { total: number; payments: { amount: number }[] }>(order: T) {
  const amountPaid = roundCents(order.payments.reduce((sum, p) => sum + p.amount, 0));
  return { ...order, amountPaid, balanceDue: roundCents(Math.max(0, order.total - amountPaid)) };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customerId, search, deliveryStatus, fulfillmentMethod } = req.query as {
      status?: string;
      customerId?: string;
      search?: string;
      deliveryStatus?: string;
      fulfillmentMethod?: string;
    };
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(deliveryStatus ? { deliveryStatus } : {}),
        ...(fulfillmentMethod ? { fulfillmentMethod } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search } },
                { customer: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { orderDate: 'desc' },
    });
    res.json(orders.map(withPaymentSummary));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: orderInclude,
    });
    res.json(withPaymentSummary(order));
  })
);

const createSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'FINANCING', 'OTHER']).default('CASH'),
  taxRate: z.number().min(0).max(1).default(0),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'PARTIALLY_PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED']).default('PAID'),
  // Amount collected at time of sale. Defaults to the full order total (the classic
  // "pay in full at checkout" POS flow); pass less than the total to record a deposit
  // and leave the rest as a layaway balance due.
  amountPaid: z.number().nonnegative().optional(),
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryAddress: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'A sales order needs at least one line item'),
});

// Creating a sales order validates stock, snapshots current selling price, decrements
// inventory, and writes an inventory log — all inside one transaction.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);

    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const lineItems: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];

      for (const item of data.items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        if (product.stockQuantity < item.quantity) {
          throw new AppError(`Insufficient stock for "${product.name}" (have ${product.stockQuantity}, need ${item.quantity})`);
        }
        const lineTotal = product.sellingPrice * item.quantity;
        subtotal += lineTotal;
        lineItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          lineTotal,
        });
      }

      if (data.discount > subtotal) {
        throw new AppError(`Discount (${data.discount}) cannot exceed the subtotal (${subtotal})`);
      }
      const taxable = subtotal - data.discount;
      const tax = roundCents(taxable * data.taxRate);
      const total = roundCents(taxable + tax);

      // Default to "paid in full" unless the caller explicitly recorded a smaller deposit.
      const amountPaid = roundCents(data.amountPaid ?? (data.status === 'CANCELLED' ? 0 : total));
      if (amountPaid > total) {
        throw new AppError(`Amount paid (${amountPaid}) cannot exceed the order total (${total})`);
      }

      // Auto-derive a payment-lifecycle status unless the caller explicitly moved the
      // order further along fulfillment (SHIPPED/COMPLETED) or cancelled it.
      let status = data.status;
      if (status !== 'CANCELLED' && status !== 'SHIPPED' && status !== 'COMPLETED') {
        status = amountPaid <= 0 ? 'PENDING' : amountPaid >= total ? 'PAID' : 'PARTIALLY_PAID';
      }

      const created = await tx.salesOrder.create({
        data: {
          orderNumber: generateOrderNumber('SO'),
          customerId: data.customerId || undefined,
          userId: req.user!.sub,
          status,
          paymentMethod: data.paymentMethod,
          taxRate: data.taxRate,
          discount: data.discount,
          subtotal,
          tax,
          total,
          notes: data.notes,
          fulfillmentMethod: data.fulfillmentMethod,
          deliveryAddress: data.deliveryAddress,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
          items: { create: lineItems },
          ...(amountPaid > 0
            ? { payments: { create: { amount: amountPaid, method: data.paymentMethod, userId: req.user!.sub } } }
            : {}),
        },
        include: orderInclude,
      });

      if (status !== 'CANCELLED') {
        for (const item of lineItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              changeQty: -item.quantity,
              reason: 'SALE',
              referenceId: created.id,
              userId: req.user!.sub,
            },
          });
        }
      }

      return created;
    });

    res.status(201).json(withPaymentSummary(order));
  })
);

const statusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'PARTIALLY_PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED']),
});

// Cancelling a previously-active order restocks its items; reactivating a cancelled
// order re-decrements them (and fails if stock is no longer available).
router.patch(
  '/:id/status',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUniqueOrThrow({ where: { id: req.params.id }, include: { items: true } });

      const wasCancelled = existing.status === 'CANCELLED';
      const willBeCancelled = status === 'CANCELLED';

      if (!wasCancelled && willBeCancelled) {
        for (const item of existing.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
          await tx.inventoryLog.create({
            data: { productId: item.productId, changeQty: item.quantity, reason: 'RETURN', referenceId: existing.id, userId: req.user!.sub },
          });
        }
      } else if (wasCancelled && !willBeCancelled) {
        for (const item of existing.items) {
          const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
          if (product.stockQuantity < item.quantity) {
            throw new AppError(`Cannot reactivate order: insufficient stock for "${product.name}"`);
          }
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
          await tx.inventoryLog.create({
            data: { productId: item.productId, changeQty: -item.quantity, reason: 'SALE', referenceId: existing.id, userId: req.user!.sub },
          });
        }
      }

      return tx.salesOrder.update({
        where: { id: req.params.id },
        data: { status },
        include: orderInclude,
      });
    });
    res.json(withPaymentSummary(order));
  })
);

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'FINANCING', 'OTHER']).default('CASH'),
  note: z.string().optional(),
});

// Records an additional payment (e.g. a layaway installment or the final balance on
// delivery) and re-derives the order's payment-lifecycle status from the new total paid.
router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { payments: true },
      });
      if (existing.status === 'CANCELLED') {
        throw new AppError('Cannot record a payment on a cancelled order');
      }
      const alreadyPaid = roundCents(existing.payments.reduce((sum, p) => sum + p.amount, 0));
      const balanceDue = roundCents(existing.total - alreadyPaid);
      if (data.amount > balanceDue + 0.01) {
        throw new AppError(`Payment of ${data.amount} exceeds the remaining balance due of ${balanceDue.toFixed(2)}`);
      }

      await tx.payment.create({
        data: { salesOrderId: existing.id, amount: data.amount, method: data.method, note: data.note, userId: req.user!.sub },
      });

      // Round before comparing so e.g. 543.46 + 815.18 doesn't fall a floating-point
      // hair short of 1358.64 and leave the order stuck at PARTIALLY_PAID.
      const newAmountPaid = roundCents(alreadyPaid + data.amount);
      let status = existing.status;
      if (status === 'PENDING' || status === 'PARTIALLY_PAID' || status === 'PAID') {
        status = newAmountPaid >= existing.total ? 'PAID' : 'PARTIALLY_PAID';
      }

      return tx.salesOrder.update({
        where: { id: req.params.id },
        data: { status },
        include: orderInclude,
      });
    });
    res.status(201).json(withPaymentSummary(order));
  })
);

const deliverySchema = z.object({
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
  deliveryAddress: z.string().optional(),
  scheduledDate: z.string().datetime().optional().nullable(),
  deliveryStatus: z.enum(['NOT_SCHEDULED', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED']).optional(),
});

router.patch(
  '/:id/delivery',
  asyncHandler(async (req, res) => {
    const data = deliverySchema.parse(req.body);
    const order = await prisma.salesOrder.update({
      where: { id: req.params.id },
      data: {
        ...(data.fulfillmentMethod ? { fulfillmentMethod: data.fulfillmentMethod } : {}),
        ...(data.deliveryAddress !== undefined ? { deliveryAddress: data.deliveryAddress } : {}),
        ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null } : {}),
        ...(data.deliveryStatus ? { deliveryStatus: data.deliveryStatus } : {}),
      },
      include: orderInclude,
    });
    res.json(withPaymentSummary(order));
  })
);

export default router;
