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
    const { status, supplierId } = req.query as { status?: string; supplierId?: string };
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { orderDate: 'desc' },
    });
    res.json(orders);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { supplier: true, items: { include: { product: true } } },
    });
    res.json(order);
  })
);

const createSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitCost: z.number().nonnegative(),
      })
    )
    .min(1, 'A purchase order needs at least one line item'),
});

router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber: generateOrderNumber('PO'),
        supplierId: data.supplierId,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        notes: data.notes,
        items: { create: data.items },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
    res.status(201).json(order);
  })
);

const statusSchema = z.object({
  status: z.enum(['PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED']),
});

// Marking a PO as RECEIVED increments stock for each line item and writes inventory logs.
router.patch(
  '/:id/status',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { items: true },
      });

      if (existing.status === 'RECEIVED' && status !== 'RECEIVED') {
        throw new AppError('Cannot change status of a purchase order that was already received');
      }

      if (status === 'RECEIVED' && existing.status !== 'RECEIVED') {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              changeQty: item.quantity,
              reason: 'PURCHASE_RECEIVED',
              referenceId: existing.id,
              userId: req.user!.sub,
            },
          });
        }
      }

      return tx.purchaseOrder.update({
        where: { id: req.params.id },
        data: { status, receivedDate: status === 'RECEIVED' ? new Date() : existing.receivedDate },
        include: { supplier: true, items: { include: { product: true } } },
      });
    });
    res.json(order);
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.status === 'RECEIVED') {
      throw new AppError('Cannot delete a received purchase order');
    }
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
