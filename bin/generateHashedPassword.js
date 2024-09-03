// run this via: node bin/generateHashedPassword.js your-password
// and put output in .env SUDO_PASSWORD var

import bcrypt from 'bcrypt';

async function generateHashedPassword() {
  const password = process.argv[2]; // get password from command-line argument
  const saltRounds = 10; // increase this number for more security but at the cost of CPU time

  if (!password) {
    console.log('Please provide a password as a command-line argument');
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const currentTimestamp = Math.floor(Date.now() / 1000); // Convert to seconds
    console.log(`SITE_PASSWORD='${hashedPassword}'`);
    console.log(`LAST_PASSWORD_CHANGE_TIMESTAMP=${currentTimestamp}`);
  } catch (error) {
    console.error(error);
  }
}

generateHashedPassword();
