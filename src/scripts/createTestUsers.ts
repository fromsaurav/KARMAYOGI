/**
 * Script to create test users for team management
 * Run with: npx ts-node src/scripts/createTestUsers.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users for team management...\n');

    const testUsers = [
      {
        fullName: 'John Doe',
        username: 'johndoe',
        email: 'john.doe@company.com',
        password: 'password123',
        role: UserRole.USER
      },
      {
        fullName: 'Jane Smith',
        username: 'janesmith',
        email: 'jane.smith@company.com',
        password: 'password123',
        role: UserRole.USER
      },
      {
        fullName: 'Mike Johnson',
        username: 'mikejohnson',
        email: 'mike.johnson@company.com',
        password: 'password123',
        role: UserRole.MANAGER
      },
      {
        fullName: 'Sarah Williams',
        username: 'sarahwilliams',
        email: 'sarah.williams@company.com',
        password: 'password123',
        role: UserRole.USER
      },
      {
        fullName: 'David Brown',
        username: 'davidbrown',
        email: 'david.brown@company.com',
        password: 'password123',
        role: UserRole.USER
      }
    ];

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email },
            { username: userData.username }
          ]
        }
      });

      if (existingUser) {
        console.log(`⏭️  Skipping ${userData.fullName} - already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcryptjs.hash(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          fullName: userData.fullName,
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          role: userData.role
        }
      });

      console.log(`✅ Created user: ${user.fullName} (${user.email}) - Role: ${user.role}`);
    }

    console.log('\n✅ Test users created successfully!');
    console.log('\nYou can login with any of these accounts:');
    console.log('Email: john.doe@company.com | Password: password123');
    console.log('Email: jane.smith@company.com | Password: password123');
    console.log('Email: mike.johnson@company.com | Password: password123');
    console.log('Email: sarah.williams@company.com | Password: password123');
    console.log('Email: david.brown@company.com | Password: password123');

  } catch (error) {
    console.error('Error creating test users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
