import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, categoryId, lowStock } = req.query as { search?: string; categoryId?: string; lowStock?: string };

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const filtered = lowStock === 'true' ? products.filter((p) => p.stockQuantity <= p.reorderLevel) : products;
    res.json(filtered);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { category: true },
    });
    res.json(product);
  })
);

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  material: z.string().optional(),
  dimensions: z.string().optional(),
  color: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  stockQuantity: z.number().int().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(5),
  imageUrl: z.string().optional(),
  categoryId: z.string().optional().nullable(),
});

router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    if (product.stockQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          changeQty: product.stockQuantity,
          reason: 'INITIAL_STOCK',
          userId: req.user!.sub,
        },
      });
    }
    res.status(201).json(product);
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    // Soft delete to preserve historical order line items.
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  })
);

const adjustSchema = z.object({
  changeQty: z.number().int().refine((n) => n !== 0, 'changeQty must not be zero'),
  note: z.string().optional(),
});

router.post(
  '/:id/adjust-stock',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { changeQty, note } = adjustSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUniqueOrThrow({ where: { id: req.params.id } });
      const newQty = current.stockQuantity + changeQty;
      if (newQty < 0) throw new Error('Stock adjustment would result in negative inventory');
      const updated = await tx.product.update({
        where: { id: req.params.id },
        data: { stockQuantity: newQty },
      });
      await tx.inventoryLog.create({
        data: {
          productId: req.params.id,
          changeQty,
          reason: 'ADJUSTMENT',
          note,
          userId: req.user!.sub,
        },
      });
      return updated;
    });
    res.json(product);
  })
);

router.get(
  '/:id/inventory-logs',
  asyncHandler(async (req, res) => {
    const logs = await prisma.inventoryLog.findMany({
      where: { productId: req.params.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(logs);
  })
);

export default router;
