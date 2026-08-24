import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeOrderFilter = { status: { notIn: ['CANCELLED'] } };

    const [
      productCount,
      customerCount,
      supplierCount,
      pendingPurchaseOrders,
      revenueToday,
      revenueMonth,
      allProducts,
      recentOrders,
      recentSales,
      monthLineItems,
      expensesMonthAgg,
      upcomingDeliveries,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.purchaseOrder.count({ where: { status: { in: ['PENDING', 'ORDERED'] } } }),
      prisma.salesOrder.aggregate({ _sum: { total: true }, where: { orderDate: { gte: startOfToday }, ...activeOrderFilter } }),
      prisma.salesOrder.aggregate({ _sum: { total: true }, where: { orderDate: { gte: startOfMonth }, ...activeOrderFilter } }),
      prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, sku: true, stockQuantity: true, reorderLevel: true, imageUrl: true } }),
      prisma.salesOrder.findMany({
        take: 5,
        orderBy: { orderDate: 'desc' },
        include: { customer: true },
      }),
      prisma.salesOrder.findMany({
        where: { orderDate: { gte: thirtyDaysAgo }, ...activeOrderFilter },
        select: { orderDate: true, total: true },
      }),
      // Line items sold this month, with each product's current cost price, to estimate COGS.
      // Note: uses the product's *current* cost price rather than a historical snapshot.
      prisma.salesOrderItem.findMany({
        where: { salesOrder: { orderDate: { gte: startOfMonth }, ...activeOrderFilter } },
        select: { quantity: true, product: { select: { costPrice: true } } },
      }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: startOfMonth } } }),
      prisma.salesOrder.findMany({
        where: {
          fulfillmentMethod: 'DELIVERY',
          deliveryStatus: { in: ['NOT_SCHEDULED', 'SCHEDULED', 'OUT_FOR_DELIVERY'] },
          status: { notIn: ['CANCELLED'] },
        },
        include: { customer: true },
        orderBy: [{ scheduledDate: 'asc' }, { orderDate: 'asc' }],
        take: 8,
      }),
    ]);

    const cogsMonth = monthLineItems.reduce((sum, li) => sum + li.quantity * li.product.costPrice, 0);
    const expensesMonth = expensesMonthAgg._sum?.amount ?? 0;
    const grossProfitMonth = (revenueMonth._sum?.total ?? 0) - cogsMonth;
    const netProfitMonth = grossProfitMonth - expensesMonth;

    const lowStockProducts = allProducts
      .filter((p) => p.stockQuantity <= p.reorderLevel)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 10);

    // Revenue bucketed by day for the last 30 days (for a simple line/bar chart).
    const byDay = new Map<string, number>();
    for (const s of recentSales) {
      const key = s.orderDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + s.total);
    }
    const revenueSeries = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    // Top-selling products (by revenue) in the last 30 days.
    const topItems = await prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where: { salesOrder: { orderDate: { gte: thirtyDaysAgo }, ...activeOrderFilter } },
      _sum: { lineTotal: true, quantity: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
    });
    const topProductIds = topItems.map((t) => t.productId);
    const topProductRecords = await prisma.product.findMany({ where: { id: { in: topProductIds } } });
    const topProducts = topItems.map((t) => ({
      product: topProductRecords.find((p) => p.id === t.productId),
      revenue: t._sum?.lineTotal ?? 0,
      unitsSold: t._sum?.quantity ?? 0,
    }));

    res.json({
      counts: { productCount, customerCount, supplierCount, pendingPurchaseOrders, lowStockCount: lowStockProducts.length },
      revenue: { today: revenueToday._sum?.total ?? 0, month: revenueMonth._sum?.total ?? 0 },
      profit: { grossMonth: grossProfitMonth, netMonth: netProfitMonth, expensesMonth, cogsMonth },
      lowStockProducts,
      recentOrders,
      revenueSeries,
      topProducts,
      upcomingDeliveries,
    });
  })
);

export default router;
