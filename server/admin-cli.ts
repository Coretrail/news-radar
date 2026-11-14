import { config } from './config.js';
import { query, pool } from './db.js';
import { newToken, tokenHash } from './auth.js';
if ((await query('SELECT 1 FROM admins')).rowCount) {
  console.log(
    'Administrador já configurado. Para recuperação, consultar docs/en/native-install.md.',
  );
} else {
  const token = newToken();
  await query('DELETE FROM bootstrap');
  await query("INSERT INTO bootstrap VALUES($1,now()+interval '15 minutes')", [tokenHash(token)]);
  console.log('Abra este endereço na LAN em 15 minutos e defina as suas credenciais:');
  console.log(`${config.appUrl}/admin#setup=${token}`);
}
await pool.end();
