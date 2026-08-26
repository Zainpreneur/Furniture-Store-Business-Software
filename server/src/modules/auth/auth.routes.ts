import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signToken, Role } from '../../utils/jwt';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { requireAuth } from '../../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  // Only settable by seed/admin flows in practice; public register defaults to STAFF.
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(user: { id: string; name: string; email: string; role: string; isActive: boolean }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

// The very first account ever created becomes ADMIN automatically so the app is usable out of the box.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existingCount = await prisma.user.count();
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: existingCount === 0 ? 'ADMIN' : data.role ?? 'STAFF',
      },
    });
    const token = signToken({ sub: user.id, email: user.email, role: user.role as Role });
    res.status(201).json({ token, user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid email or password');
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');
    const token = signToken({ sub: user.id, email: user.email, role: user.role as Role });
    res.json({ token, user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new UnauthorizedError();
    res.json(publicUser(user));
  })
);

export default router;
