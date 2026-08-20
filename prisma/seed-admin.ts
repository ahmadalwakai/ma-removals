import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const db = new PrismaClient({ adapter });

async function main() {
  const email = "ahmadalwakai76@gmail.com";
  const plainPassword = "Aa234311Aa@@@";
  const name = "Ahmad Al-Wakai";

  const hashed = await bcrypt.hash(plainPassword, 12);

  const user = await db.user.upsert({
    where: { email },
    update: {
      name,
      password: hashed,
      role: "ADMIN",
    },
    create: {
      email,
      name,
      password: hashed,
      role: "ADMIN",
    },
  });

  console.log(`✓ Admin user ready: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
