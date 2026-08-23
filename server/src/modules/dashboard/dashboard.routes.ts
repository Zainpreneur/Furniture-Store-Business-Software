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
    ]);

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
      lowStockProducts,
      recentOrders,
      revenueSeries,
      topProducts,
    });
  })
);

export default router;
