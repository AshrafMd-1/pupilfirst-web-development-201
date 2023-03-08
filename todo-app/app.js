const express = require("express");
const app = express();
const {Todo} = require("./models");
const bodyParser = require("body-parser");
const {all} = require("express/lib/application");
const path = require("path");

app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(express.static(path.resolve(__dirname, "public")))

app.get("/", async (request, response) => {
    const overdue = await Todo.overdueTodos()
    const today = await Todo.todayTodos()
    const later = await Todo.laterTodos()
    if (request.accepts("html")) {
        response.render("index", {
            overdueTodos: overdue,
            todayTodos: today,
            laterTodos: later,
            overdueCount: overdue.length,
            todayCount: today.length,
            laterCount: later.length
        })
    } else {
        response.json({
            allTodos
        })
    }
});
app.get("/todos", async function (_request, response) {
    console.log("Processing list of all Todos ...");
    // FILL IN YOUR CODE HERE
    // First, we have to query our PostgerSQL database using Sequelize to get list of all Todos.
    // Then, we have to respond with all Todos, like:
    // response.send(todos)
    const allTodos = await Todo.findAll()
    response.json(allTodos)
});

app.get("/todos/:id", async function (request, response) {
    try {
        const todo = await Todo.findByPk(request.params.id);
        return response.json(todo);
    } catch (error) {
        console.log(error);
        return response.status(422).json(error);
    }
});

app.post("/todos", async function (request, response) {
    try {
        const todo = await Todo.addTodo(request.body);
        return response.json(todo);
    } catch (error) {
        console.log(error);
        return response.status(422).json(error);
    }
});

app.put("/todos/:id/markAsCompleted", async function (request, response) {
    const todo = await Todo.findByPk(request.params.id);
    try {
        const updatedTodo = await todo.markAsCompleted();
        return response.json(updatedTodo);
    } catch (error) {
        console.log(error);
        return response.status(422).json(error);
    }
});

app.delete("/todos/:id", async function (request, response) {
    console.log("We have to delete a Todo with ID: ", request.params.id);
    // FILL IN YOUR CODE HERE
    // First, we have to query our database to delete a Todo by ID.
    // Then, we have to respond back with true/false based on whether the Todo was deleted or not.
    // response.send(true)
    const delTodo = await Todo.findByPk(request.params.id)
    if (delTodo == null) {
        response.send("false")
    } else {
        await delTodo.destroy()
        response.send('true')
    }
});

module.exports = app;
