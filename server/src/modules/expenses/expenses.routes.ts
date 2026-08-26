import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
// Expenses are financial records — restrict the whole resource to Admin/Manager.
router.use(requireAuth, requireRole('ADMIN', 'MANAGER'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, category } = req.query as { from?: string; to?: string; category?: string };
    const expenses = await prisma.expense.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(from || to
          ? {
              expenseDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' },
    });
    res.json(expenses);
  })
);

const expenseSchema = z.object({
  category: z.enum(['RENT', 'UTILITIES', 'WAGES', 'MARKETING', 'SUPPLIES', 'SHIPPING', 'OTHER']),
  description: z.string().optional(),
  amount: z.number().positive(),
  expenseDate: z.string().datetime().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.create({
      data: {
        category: data.category,
        description: data.description,
        amount: data.amount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
        userId: req.user!.sub,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json(expense);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = expenseSchema.partial().parse(req.body);
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.expenseDate ? { expenseDate: new Date(data.expenseDate) } : {}),
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json(expense);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
