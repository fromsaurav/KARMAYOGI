import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const [userPw, managerPw, adminPw] = await Promise.all([
    hash('testpassword123'),
    hash('manager123456'),
    hash('admin123456'),
  ]);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      password: userPw,
      role: UserRole.USER,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      fullName: 'Manager User',
      username: 'manager',
      email: 'manager@example.com',
      password: managerPw,
      role: UserRole.MANAGER,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      fullName: 'Admin User',
      username: 'admin',
      email: 'admin@example.com',
      password: adminPw,
      role: UserRole.ADMIN,
    },
  });

  console.log('Created users:', [
    { fullName: testUser.fullName,    email: testUser.email,    role: testUser.role },
    { fullName: managerUser.fullName, email: managerUser.email, role: managerUser.role },
    { fullName: adminUser.fullName,   email: adminUser.email,   role: adminUser.role },
  ]);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
