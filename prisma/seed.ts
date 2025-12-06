import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a test user for login
  const testUserPassword = await bcrypt.hash('testpassword123', 12);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'test@example.com',
      password: testUserPassword,
      role: UserRole.USER,
    },
  });

  // Create an admin user
  const adminPassword = await bcrypt.hash('admin123456', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log('Created users:', {
    testUser: { name: testUser.name, email: testUser.email, role: testUser.role },
    adminUser: { name: adminUser.name, email: adminUser.email, role: adminUser.role }
  });

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