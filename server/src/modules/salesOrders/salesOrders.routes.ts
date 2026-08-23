import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { generateOrderNumber } from '../../utils/orderNumber';
import { AppError } from '../../utils/errors';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customerId } = req.query as { status?: string; customerId?: string };
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
      orderBy: { orderDate: 'desc' },
    });
    res.json(orders);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        customer: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });
    res.json(order);
  })
);

const createSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'FINANCING', 'OTHER']).default('CASH'),
  taxRate: z.number().min(0).max(1).default(0),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED']).default('PAID'),
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

      const tax = subtotal * data.taxRate;
      const total = subtotal + tax;

      const created = await tx.salesOrder.create({
        data: {
          orderNumber: generateOrderNumber('SO'),
          customerId: data.customerId || undefined,
          userId: req.user!.sub,
          status: data.status,
          paymentMethod: data.paymentMethod,
          taxRate: data.taxRate,
          subtotal,
          tax,
          total,
          notes: data.notes,
          items: { create: lineItems },
        },
        include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } },
      });

      if (data.status !== 'CANCELLED') {
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

    res.status(201).json(order);
  })
);

const statusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED']),
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
        include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } },
      });
    });
    res.json(order);
  })
);

export default router;
