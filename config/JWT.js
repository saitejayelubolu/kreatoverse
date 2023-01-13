const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");
const User = require("../model/userModel");
const dotenv = require("dotenv").config();

// const loginrequired = async (req, res, next) => {
//   const token = req.cookies["access-token"];
//   if (token) {
//     const validatetoken = await jwt.verify(token, process.env.JWT_SECRET);
//     if (validatetoken) {
//       res.user = validatetoken.id;
//       next();
//     } else {
//       console.log("token expires");
//     }
//   } else {
//     console.log("token not found");
//   }
// };

//verify email
const verifyEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user.status == "Active") {
      next();
    } else {
      console.log("please check your email to verify your account");
      res.send("please check your email to verify your account");
    }
  } catch (error) {
    console.log(error);
  }
};

// jwt
let auth = (req, res, next) => {
  // console.log("token is ", req.headers)
  let token = req.headers["x-access-token"] || req.headers["authorization"];
  if (token == null) {
    return res.status(401).json({
      status: false,
      message: "Auth token is not supplied",
    });
  }

  if (token.startsWith("Bearer ")) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
  }

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          status: false,
          message: "Token is not valid",
        });
      } else {
        req.decoded = decoded;
        // console.log(decoded.id);
        var user_id = decoded.id;
        next();
      }
    });
  } else {
    return res.status(401).json({
      status: false,
      message: "Auth token is not supplied",
    });
  }
};

module.exports = { auth, verifyEmail };
