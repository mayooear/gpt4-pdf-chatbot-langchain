import express from 'express';
import next from 'next';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import { body, validationResult } from 'express-validator';
import pg from 'pg';
import bcrypt from 'bcrypt';


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

app.use(express.json());

// Middleware

passport.use(new LocalStrategy(
  (username, password, done) => {
    if (username === 'admin' && password === 'admin') {
      return done(null, username);
    } else {
      return done(null, false);
    }

    // Implement bcrypt here once we have a db
  }
));

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/auth');
  }
}

// Serialize the user

passport.serializeUser((username, done) => {
  done(null, username);
})

// Deserialize the user

passport.deserializeUser((username, done) => {
  if (username === 'admin') {
    done(null, username);
  } else {
    done(new Error("Invalid username"));
  }
})

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'shfksadjfhs', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

nextApp.prepare().then(() => {
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/app', ensureAuthenticated, (req, res) => {
    return nextApp.render(req, res, '/app', req.query);
  });

  app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/auth.html'));
  });

  app.post('/auth', passport.authenticate('local', { failureRedirect: '/auth' }), (req, res) => {
    res.redirect('/app');
  });

  app.get('/sign-up', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/sign-up.html'));
  });

  // Sign-up auth + sanitisation

  app.post('/sign-up', [
    body('username').trim().isLength({ min: 1 }).escape(),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').trim().isLength({ min: 6 }).escape(),
  ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { username, email, password, confirm_password } = req.body;
    if (password !== confirm_password) {
      res.status(500);
      throw new Error("Passwords do not match");
    }

    // Generate salt
    const saltRounds = 7;
    bcrypt.genSalt(saltRounds, (error, salt) => {
      if (error) {
        res.status(500);
        throw error;
      }

      // Hash the password
      bcrypt.hash(password, salt, (error, hash) => {
        if (error) {
          res.status(500);
          throw error;
        }

        const query = `INSERT INTO users (username, email, password) VALUES (?, ?, ?);`
        
        // Handle error and inject SQL once we have connection;

        res.redirect('/app');
      });
    });
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(3001, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3001');
  });
});
