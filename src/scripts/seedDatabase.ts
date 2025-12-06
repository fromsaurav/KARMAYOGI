import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { JobType, JobStatus, JobPriority } from '../types';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing job data only
    console.log('🗑️  Clearing existing job data...');
    await prisma.job.deleteMany({});

    // Get or create users
    console.log('👥 Getting or creating users...');
    const users = [];

    // Create 10 regular users (skip if exists)
    for (let i = 1; i <= 10; i++) {
      const email = `user${i}@karmayogi.com`;
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 12);
        user = await prisma.user.create({
          data: {
            id: uuidv4(),
            fullName: `User ${i}`,
            username: `user${i}`,
            email,
            password: hashedPassword,
            role: 'USER',
            profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
          },
        });
        console.log(`  ✓ Created user: ${user.email}`);
      } else {
        console.log(`  ℹ User exists: ${user.email}`);
      }
      users.push(user);
    }

    // Create 3 managers (skip if exists)
    const managers = [];
    for (let i = 1; i <= 3; i++) {
      const email = `manager${i}@karmayogi.com`;
      let manager = await prisma.user.findUnique({ where: { email } });

      if (!manager) {
        const hashedPassword = await bcrypt.hash('password123', 12);
        manager = await prisma.user.create({
          data: {
            id: uuidv4(),
            fullName: `Manager ${i}`,
            username: `manager${i}`,
            email,
            password: hashedPassword,
            role: 'MANAGER',
            profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=manager${i}`,
          },
        });
        console.log(`  ✓ Created manager: ${manager.email}`);
      } else {
        console.log(`  ℹ Manager exists: ${manager.email}`);
      }
      managers.push(manager);
    }

    // Create admin if doesn't exist
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const admin = await prisma.user.create({
        data: {
          id: uuidv4(),
          fullName: 'System Admin',
          username: 'admin',
          email: 'admin@karmayogi.com',
          password: hashedPassword,
          role: 'ADMIN',
          profilePic: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        },
      });
      console.log(`  ✓ Created admin: ${admin.email}`);
    } else {
      console.log('  ℹ Admin already exists, skipping...');
    }

    // Create jobs for users
    console.log('📋 Creating jobs...');
    const jobTypes = [JobType.FILE_PROCESSING, JobType.DATA_ANALYTICS, JobType.EMAIL_TASK, JobType.API_INTEGRATION, JobType.CUSTOM_SCRIPT];
    const jobStatuses = [JobStatus.PENDING, JobStatus.ACTIVE, JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED];
    const priorities = [JobPriority.HIGH, JobPriority.MEDIUM, JobPriority.LOW];

    let jobCount = 0;

    // Create 5-15 jobs for each user
    for (const user of users) {
      const numJobs = Math.floor(Math.random() * 11) + 5; // 5 to 15 jobs

      for (let i = 0; i < numJobs; i++) {
        const jobType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
        const status = jobStatuses[Math.floor(Math.random() * jobStatuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        // Create a date within the last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        const jobData = {
          id: uuidv4(),
          userId: user.id,
          type: jobType,
          status,
          priority,
          payload: {
            description: `Sample ${jobType.toLowerCase().replace('_', ' ')} job`,
            parameters: {
              input: 'sample_input.txt',
              output: 'sample_output.txt',
            },
          },
          maxRetries: 3,
          currentRetry: status === 'FAILED' ? Math.floor(Math.random() * 3) : 0,
          createdAt,
          updatedAt: new Date(),
          progress: status === 'ACTIVE' ? Math.floor(Math.random() * 100) : status === 'COMPLETED' ? 100 : 0,
          startedAt: status !== 'PENDING' ? createdAt : null,
          completedAt: status === 'COMPLETED' ? new Date(createdAt.getTime() + Math.random() * 3600000) : null,
        };

        await prisma.job.create({ data: jobData });
        jobCount++;
      }

      console.log(`  ✓ Created ${numJobs} jobs for ${user.email}`);
    }

    // Create jobs for managers (they can also have jobs)
    for (const manager of managers) {
      const numJobs = Math.floor(Math.random() * 6) + 3; // 3 to 8 jobs

      for (let i = 0; i < numJobs; i++) {
        const jobType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
        const status = jobStatuses[Math.floor(Math.random() * jobStatuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        const jobData = {
          id: uuidv4(),
          userId: manager.id,
          type: jobType,
          status,
          priority,
          payload: {
            description: `Manager ${jobType.toLowerCase().replace('_', ' ')} job`,
            parameters: {
              input: 'manager_input.txt',
              output: 'manager_output.txt',
            },
          },
          maxRetries: 3,
          currentRetry: status === 'FAILED' ? Math.floor(Math.random() * 3) : 0,
          createdAt,
          updatedAt: new Date(),
          progress: status === 'ACTIVE' ? Math.floor(Math.random() * 100) : status === 'COMPLETED' ? 100 : 0,
          startedAt: status !== 'PENDING' ? createdAt : null,
          completedAt: status === 'COMPLETED' ? new Date(createdAt.getTime() + Math.random() * 3600000) : null,
        };

        await prisma.job.create({ data: jobData });
        jobCount++;
      }

      console.log(`  ✓ Created ${numJobs} jobs for ${manager.email}`);
    }

    console.log(`\n✅ Database seeding completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Users created: ${users.length}`);
    console.log(`   - Managers created: ${managers.length}`);
    console.log(`   - Total jobs created: ${jobCount}`);
    console.log(`\n🔐 Login Credentials:`);
    console.log(`   Regular Users: user1@karmayogi.com to user10@karmayogi.com (password: password123)`);
    console.log(`   Managers: manager1@karmayogi.com to manager3@karmayogi.com (password: password123)`);
    console.log(`   Admin: admin@karmayogi.com (password: admin123)`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDatabase()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
