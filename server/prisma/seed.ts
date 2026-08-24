import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@furniturestore.com' },
    update: {},
    create: { name: 'Alex Admin', email: 'admin@furniturestore.com', passwordHash, role: 'ADMIN' },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@furniturestore.com' },
    update: {},
    create: { name: 'Morgan Manager', email: 'manager@furniturestore.com', passwordHash, role: 'MANAGER' },
  });
  const staff = await prisma.user.upsert({
    where: { email: 'staff@furniturestore.com' },
    update: {},
    create: { name: 'Sam Staff', email: 'staff@furniturestore.com', passwordHash, role: 'STAFF' },
  });

  const categoryDefs = [
    { name: 'Living Room', description: 'Sofas, coffee tables, TV stands' },
    { name: 'Bedroom', description: 'Beds, dressers, nightstands' },
    { name: 'Dining', description: 'Dining tables and chairs' },
    { name: 'Office', description: 'Desks and office chairs' },
    { name: 'Outdoor', description: 'Patio and garden furniture' },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
    categories[c.name] = cat.id;
  }

  const productDefs = [
    { sku: 'SOF-001', name: 'Harbor 3-Seat Sofa', category: 'Living Room', material: 'Linen fabric', dimensions: '84in x 36in x 34in', color: 'Charcoal', costPrice: 420, sellingPrice: 899, stockQuantity: 12, reorderLevel: 4 },
    { sku: 'SOF-002', name: 'Nordic Loveseat', category: 'Living Room', material: 'Velvet', dimensions: '62in x 34in x 32in', color: 'Emerald', costPrice: 260, sellingPrice: 549, stockQuantity: 8, reorderLevel: 3 },
    { sku: 'CTB-001', name: 'Oakwood Coffee Table', category: 'Living Room', material: 'Solid oak', dimensions: '48in x 24in x 18in', color: 'Natural', costPrice: 110, sellingPrice: 259, stockQuantity: 20, reorderLevel: 5 },
    { sku: 'TVS-001', name: 'Media Console 65"', category: 'Living Room', material: 'Engineered wood', dimensions: '65in x 16in x 22in', color: 'Walnut', costPrice: 150, sellingPrice: 349, stockQuantity: 3, reorderLevel: 4 },
    { sku: 'BED-001', name: 'Willow Queen Bed Frame', category: 'Bedroom', material: 'Solid pine', dimensions: '63in x 85in x 45in', color: 'White', costPrice: 300, sellingPrice: 699, stockQuantity: 6, reorderLevel: 3 },
    { sku: 'BED-002', name: 'Aspen King Bed Frame', category: 'Bedroom', material: 'Solid pine', dimensions: '78in x 85in x 48in', color: 'Espresso', costPrice: 360, sellingPrice: 829, stockQuantity: 2, reorderLevel: 3 },
    { sku: 'DRS-001', name: '6-Drawer Dresser', category: 'Bedroom', material: 'Engineered wood', dimensions: '60in x 18in x 34in', color: 'White', costPrice: 190, sellingPrice: 429, stockQuantity: 9, reorderLevel: 4 },
    { sku: 'NST-001', name: 'Bedside Nightstand', category: 'Bedroom', material: 'Solid pine', dimensions: '20in x 16in x 24in', color: 'Natural', costPrice: 45, sellingPrice: 119, stockQuantity: 25, reorderLevel: 8 },
    { sku: 'DIN-001', name: 'Rustic Dining Table (6-seat)', category: 'Dining', material: 'Reclaimed wood', dimensions: '72in x 38in x 30in', color: 'Weathered brown', costPrice: 380, sellingPrice: 849, stockQuantity: 5, reorderLevel: 3 },
    { sku: 'DIN-002', name: 'Dining Chair (set of 2)', category: 'Dining', material: 'Solid oak / fabric', dimensions: '18in x 20in x 36in', color: 'Beige', costPrice: 90, sellingPrice: 199, stockQuantity: 30, reorderLevel: 10 },
    { sku: 'OFC-001', name: 'Executive Office Desk', category: 'Office', material: 'Engineered wood / steel', dimensions: '60in x 28in x 30in', color: 'Black/Oak', costPrice: 160, sellingPrice: 379, stockQuantity: 7, reorderLevel: 3 },
    { sku: 'OFC-002', name: 'Ergonomic Mesh Office Chair', category: 'Office', material: 'Mesh / steel', dimensions: '26in x 26in x 45in', color: 'Black', costPrice: 85, sellingPrice: 219, stockQuantity: 4, reorderLevel: 5 },
    { sku: 'OUT-001', name: '4-Piece Patio Set', category: 'Outdoor', material: 'Rattan / cushion', dimensions: 'Set of 4', color: 'Grey', costPrice: 340, sellingPrice: 749, stockQuantity: 6, reorderLevel: 2 },
  ];

  const products: Record<string, string> = {};
  for (const p of productDefs) {
    const { category, ...rest } = p;
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...rest, categoryId: categories[category] },
    });
    products[p.sku] = product.id;
  }

  const customerDefs = [
    { name: 'Jordan Rivera', email: 'jordan.rivera@example.com', phone: '555-0101', address: '12 Maple St, Springfield' },
    { name: 'Casey Kim', email: 'casey.kim@example.com', phone: '555-0102', address: '48 Birch Ave, Springfield' },
    { name: 'Taylor Brooks', email: 'taylor.brooks@example.com', phone: '555-0103', address: '9 Cedar Ln, Rivertown' },
    { name: 'Riley Nguyen', email: 'riley.nguyen@example.com', phone: '555-0104', address: '221 Oak Blvd, Rivertown' },
  ];
  const customers = [];
  for (const c of customerDefs) {
    const existing = await prisma.customer.findFirst({ where: { email: c.email } });
    customers.push(existing ?? (await prisma.customer.create({ data: c })));
  }

  const supplierDefs = [
    { name: 'Timberline Wood Co.', contactName: 'Pat Lee', email: 'sales@timberlinewood.example', phone: '555-0200', address: '100 Industrial Way' },
    { name: 'Comfort Textiles Ltd.', contactName: 'Drew Chen', email: 'orders@comforttextiles.example', phone: '555-0201', address: '55 Fabric Row' },
    { name: 'MetalCraft Fittings', contactName: 'Jamie Ortiz', email: 'contact@metalcraft.example', phone: '555-0202', address: '8 Foundry Ct' },
  ];
  const suppliers = [];
  for (const s of supplierDefs) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    suppliers.push(existing ?? (await prisma.supplier.create({ data: s })));
  }

  // Sample sales orders (only create if none exist yet, so re-running seed is idempotent).
  const salesOrderCount = await prisma.salesOrder.count();
  if (salesOrderCount === 0) {
    const sampleOrders = [
      {
        customer: customers[0],
        user: staff,
        items: [{ sku: 'SOF-001', qty: 1 }, { sku: 'CTB-001', qty: 1 }],
        daysAgo: 1,
        status: 'COMPLETED' as const,
        discount: 0,
        fullyPaid: true,
      },
      {
        customer: customers[1],
        user: manager,
        items: [{ sku: 'DIN-001', qty: 1 }, { sku: 'DIN-002', qty: 3 }],
        daysAgo: 3,
        status: 'COMPLETED' as const,
        discount: 50, // manager-approved discount
        fullyPaid: true,
      },
      {
        customer: customers[2],
        user: staff,
        items: [{ sku: 'BED-001', qty: 1 }, { sku: 'NST-001', qty: 2 }],
        daysAgo: 6,
        status: 'PAID' as const,
        discount: 0,
        fullyPaid: true,
      },
      {
        customer: customers[3],
        user: staff,
        items: [{ sku: 'OFC-001', qty: 1 }, { sku: 'OFC-002', qty: 1 }],
        daysAgo: 10,
        status: 'SHIPPED' as const,
        discount: 0,
        fullyPaid: true,
      },
      {
        customer: customers[0],
        user: manager,
        items: [{ sku: 'OUT-001', qty: 1 }],
        daysAgo: 15,
        status: 'COMPLETED' as const,
        discount: 0,
        fullyPaid: true,
      },
      // Layaway example: a big-ticket delivery order with only a deposit paid so far.
      {
        customer: customers[1],
        user: manager,
        items: [{ sku: 'BED-002', qty: 1 }, { sku: 'DRS-001', qty: 1 }],
        daysAgo: 2,
        status: 'PARTIALLY_PAID' as const,
        discount: 0,
        fullyPaid: false,
        depositFraction: 0.4,
        delivery: { address: '48 Birch Ave, Springfield', scheduledInDays: 5, status: 'SCHEDULED' as const },
      },
      // A second delivery example, already out for delivery, paid in full.
      {
        customer: customers[3],
        user: staff,
        items: [{ sku: 'SOF-002', qty: 1 }],
        daysAgo: 1,
        status: 'PAID' as const,
        discount: 0,
        fullyPaid: true,
        delivery: { address: '221 Oak Blvd, Rivertown', scheduledInDays: 1, status: 'OUT_FOR_DELIVERY' as const },
      },
    ];

    for (const so of sampleOrders) {
      let subtotal = 0;
      const items = [];
      for (const it of so.items) {
        const product = await prisma.product.findUniqueOrThrow({ where: { id: products[it.sku] } });
        const lineTotal = product.sellingPrice * it.qty;
        subtotal += lineTotal;
        items.push({ productId: product.id, quantity: it.qty, unitPrice: product.sellingPrice, lineTotal });
      }
      const discount = so.discount ?? 0;
      const taxable = subtotal - discount;
      const tax = taxable * 0.08;
      const total = taxable + tax;
      const orderDate = new Date(Date.now() - so.daysAgo * 24 * 60 * 60 * 1000);
      const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
      const amountPaid = so.fullyPaid ? total : Math.round(total * (so.depositFraction ?? 0.5) * 100) / 100;

      await prisma.salesOrder.create({
        data: {
          orderNumber: `SO-SEED-${rand}`,
          customerId: so.customer.id,
          userId: so.user.id,
          status: so.status,
          paymentMethod: 'CARD',
          taxRate: 0.08,
          discount,
          subtotal,
          tax,
          total,
          orderDate,
          fulfillmentMethod: so.delivery ? 'DELIVERY' : 'PICKUP',
          deliveryAddress: so.delivery?.address,
          scheduledDate: so.delivery ? new Date(Date.now() + so.delivery.scheduledInDays * 24 * 60 * 60 * 1000) : undefined,
          deliveryStatus: so.delivery?.status ?? 'NOT_SCHEDULED',
          items: { create: items },
          payments: amountPaid > 0 ? { create: { amount: amountPaid, method: 'CARD', userId: so.user.id } } : undefined,
        },
      });
      // Reduce stock to reflect the sale (seed products above already account for post-sale stock levels).
    }
  }

  // Sample operating expenses, spread across this month, for the profit report.
  const expenseCount = await prisma.expense.count();
  if (expenseCount === 0) {
    const expenseDefs = [
      { category: 'RENT', description: 'Showroom + warehouse rent', amount: 1200, daysAgo: 20, user: admin },
      { category: 'WAGES', description: 'Staff payroll (bi-weekly)', amount: 1500, daysAgo: 14, user: admin },
      { category: 'UTILITIES', description: 'Electricity & water', amount: 210, daysAgo: 10, user: manager },
      { category: 'MARKETING', description: 'Local newspaper + social ads', amount: 300, daysAgo: 8, user: manager },
      { category: 'SHIPPING', description: 'Freight for incoming inventory', amount: 250, daysAgo: 4, user: manager },
      { category: 'SUPPLIES', description: 'Packing materials & tape', amount: 95, daysAgo: 2, user: staff },
    ] as const;
    for (const e of expenseDefs) {
      await prisma.expense.create({
        data: {
          category: e.category,
          description: e.description,
          amount: e.amount,
          expenseDate: new Date(Date.now() - e.daysAgo * 24 * 60 * 60 * 1000),
          userId: e.user.id,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('Demo accounts (password: password123):');
  console.log(`  Admin:   ${admin.email}`);
  console.log(`  Manager: ${manager.email}`);
  console.log(`  Staff:   ${staff.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
