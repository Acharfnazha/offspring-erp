// Point Prisma at the isolated test database before any module creates a client.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://offspring:offspring@localhost:5432/offspring_erp_test?schema=public";
