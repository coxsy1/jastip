import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const defaultPassword = await bcrypt.hash("Password123!", saltRounds);

  const users = [
    { email: "owner@jastipops.com", name: "Owner JastipOps", role: Role.OWNER },
    { email: "admin@jastipops.com", name: "Admin JastipOps", role: Role.ADMIN },
    { email: "warehouse@jastipops.com", name: "Warehouse JastipOps", role: Role.WAREHOUSE },
  ];

  await Promise.all(
    users.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
        },
        create: {
          ...u,
          password: defaultPassword,
          isActive: true,
          mustChangePassword: false,
        },
      })
    )
  );

  console.log(`✅ ${users.length} user (Owner, Admin, Warehouse) berhasil di-seed!`);
}

await main()
  .catch((e) => {
    console.error("❌ Seeding gagal:", e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
