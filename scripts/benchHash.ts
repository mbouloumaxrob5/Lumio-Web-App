import argon2 from 'argon2';

async function bench() {
  const password = 'Password123!';
  console.time('argon2-hash');
  await argon2.hash(password, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 });
  console.timeEnd('argon2-hash');
}

bench().catch((e) => { console.error(e); process.exit(1); });
