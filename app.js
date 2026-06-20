var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
const errorMiddleware = require("./src/middlewares/errorMiddleware");


var indexRouter = require("./src/routes/index");
var usersRouter = require("./src/routes/usersRoutes");
var authRouter = require("./src/routes/authRoutes");
var categoryRoutes = require("./src/routes/categoryRoutes");
var productRoutes = require('./src/routes/productRoutes');
var cartRoutes = require("./src/routes/cartRoutes");
var wishlist = require("./src/routes/wishlistRoutes");
var orderRoutes = require("./src/routes/orderRoutes");
var addressRoutes = require("./src/routes/addressRoutes");
var reviewRoutes = require("./src/routes/reviewRoutes");
var paymentRoutes = require("./src/routes/paymentRoutes");

var app = express();

app.use(cors({
  origin: ["https://nexus-shop-boobalan.vercel.app", "http://localhost:5173", "http://34.93.249.182"],
  credentials: true,
}));

// view engine setup
app.set("views", path.join(__dirname, "src/views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/category", categoryRoutes);
app.use("/api/product", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlist);
app.use("/api/order", orderRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});


app.use(errorMiddleware)

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
