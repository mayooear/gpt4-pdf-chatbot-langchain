import express from 'express';
import next from 'next';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

// Middleware

passport.use(new LocalStrategy(
  (username, password, done) => {
    if (username === 'admin' && password === 'admin') {
      return done(null, username);
    } else {
      return done(null, false);
    }
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
    // Replace res.render() with res.sendFile() to send the HTML file directly
    res.sendFile(path.join(__dirname, 'public/auth.html'));
  });

  app.post('/auth', passport.authenticate('local', { failureRedirect: '/auth'}), (req, res) => {
    res.redirect('/app');
  })

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(3001, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3001');
  });
});
