const express = require("express");
const bodyParser = require("body-parser");
const csurf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
require("dotenv").config(); 

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");

const path = require("path");
const { Todo } = require("./models");
const { User } = require("./models");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
// eslint-disable-next-line no-undef
app.use(express.static(path.resolve(__dirname, "public")));

app.use(cookieParser('h4}A~`yes"A]?87F/zc!'));
app.use(csurf("2r~h8B_]{eb8n!CQ6-m~I>E:9B,#43XE", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "3#KFqTZJHxABh@M|95nc0u./zR%^qC_j/",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      User.findOne({
        where: {
          email,
        },
      })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password." });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Incorrect email." });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error);
    });
});

app.get("/", async (request, response) => {
  if (request.user) {
    return response.redirect("/todos");
  }
  response.render("index", { csrfToken: request.csrfToken() });
});

app.get("/signup", (request, response) => {
  if (request.user) {
    return response.redirect("/todos");
  }
  response.render("signup", {
    csrfToken: request.csrfToken(),
  });
});

app.post("/users", async (request, response) => {
  if (request.body.password === "") {
    console.log("Password cannot be empty");
    response.locals.messages = request.flash(
      "error",
      "Password cannot be empty"
    );
    return response.redirect("/signup");
  }
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  try {
    const user = await User.create({
      firstName: request.body.firstname.toUpperCase(),
      lastName: request.body.lastname.toUpperCase(),
      email: request.body.email,
      password: hashedPassword,
    });
    request.login(user, (error) => {
      if (error) {
        console.log(error);
        response.locals.messages = request.flash(
          "error",
          error.errors[0].message
        );
        return response.redirect("/signup");
      }
      return response.redirect("/todos");
    });
  } catch (error) {
    console.log(error);
    response.locals.messages = request.flash("error", error.errors[0].message);
    return response.redirect("/signup");
  }
});

app.get("/login", (request, response) => {
  if (request.user) {
    return response.redirect("/todos");
  }
  response.render("login", {
    csrfToken: request.csrfToken(),
  });
});

app.post(
  "/sessions",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/todos");
  }
);

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("Processing list of all Todos ...");
    const loggedUser = request.user.id;
    try {
      const overdue = await Todo.overdueTodos(loggedUser);
      const today = await Todo.todayTodos(loggedUser);
      const later = await Todo.laterTodos(loggedUser);
      const completed = await Todo.completedTodos(loggedUser);
      let username = await User.findUserById(loggedUser);
      if (username.lastName) {
        username = username.firstName + " " + username.lastName;
      } else {
        username = username.firstName;
      }
      response.render("todos", {
        username: username,
        overdueTodos: overdue,
        todayTodos: today,
        laterTodos: later,
        completedTodos: completed,
        overdueCount: overdue.length,
        todayCount: today.length,
        laterCount: later.length,
        completedCount: completed.length,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.log(error);
      response.locals.messages = request.flash(
        "error",
        error.errors[0].message
      );
      return response.redirect("/todos");
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("Processing a new Todo with title: ", request.body.title);
    const firstLetterCapital = (text) => {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };
    try {
      await Todo.addTodo({
        title: firstLetterCapital(request.body.title),
        dueDate: request.body.dueDate,
        UserId: request.user.id,
      });
      response.locals.messages = request.flash(
        "success",
        "Todo added successfully"
      );
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      response.locals.messages = request.flash(
        "error",
        error.errors[0].message
      );
      return response.redirect("/todos");
    }
  }
);

app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("Marking a Todo as completed with ID: ", request.params.id);
    try {
      const todo = await Todo.findOne({
        where: {
          id: request.params.id,
          UserId: request.user.id,
        },
      });
      const updatedTodo = await todo.setCompletionStatus(
        request.body.completed
      );
      response.locals.messages = request.flash(
        "success",
        "Todo updated successfully"
      );
      return response.json(updatedTodo);
    } catch (error) {
      console.log(error);
      response.locals.messages = request.flash(
        "error",
        "You do not have permission to update this Todo"
      );
      return response.redirect("/todos");
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("Delete a Todo with the ID: ", request.params.id);
    try {
      await Todo.removeTodo({
        id: request.params.id,
        UserId: request.user.id,
      });
      response.locals.messages = request.flash(
        "success",
        "Todo deleted successfully"
      );
      return response.json({ success: true });
    } catch (error) {
      console.log(error);
      response.locals.messages = request.flash(
        "error",
        "You do not have permission to delete this Todo"
      );
      return response.redirect("/todos");
    }
  }
);

app.get("/signout", (request, response, next) => {
  request.logout((error) => {
    if (error) {
      console.log(error);
      return next(error);
    }
    return response.redirect("/");
  });
});

app.listen(process.env.PORT, () => {
  console.log(
    "Started express server at port http://localhost:" + process.env.PORT
  );
});

