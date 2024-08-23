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
    console.log(hashedPassword);
  } catch (error) {
    console.error(error);
  }
}

generateHashedPassword();
