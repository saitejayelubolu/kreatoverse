const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const User = require("./model/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cookie = require("cookie-parser");
const { create } = require("./model/userModel");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv").config();
const { auth, verifyEmail } = require("./config/JWT");
const Mail = require("nodemailer/lib/mailer");
const blogModel = require("./model/blogModel");
const cloudinary = require("cloudinary").v2;
// const fileUpload = require("express-fileupload");
const { uploadImages } = require("./config/uploadToCloudinary");
const multer = require("multer");
const userModel = require("./model/userModel");
const upload = multer();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(express.json());
// app.use(
//   fileUpload({ useTempFiles: true, limits: { fileSize: 50 * 2024 * 1024 } })
// );
mongoose.set("strictQuery", false);
mongoose
  .connect("mongodb://127.0.0.1:27017/test", { useNewUrlParser: true })
  .catch(error => handleError(error));

//cloudinary
cloudinary.config({
  cloud_name: "dskwoclcd",
  api_key: "394413329513282",
  api_secret: "RO83gimeUd0Iu5RMsfLsUtw7WYo",
});

app.get("/", auth, (req, res) => {
  res.send("Hello world");
});

const createToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

//nodemailer
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "saiteja.5123@gmail.com",
    pass: "whaqkcnfhzpcgwfm",
  },
  tls: {
    rejectUnauthorized: false,
  },
});

//sign up
app.post("/signup", (req, res) => {
  let email = req.body.email;
  console.log();
  userModel.find({ email: email }, async (err, userObj) => {
    if (err) {
      res.send({ err });
    } else if (userObj[0]) {
      console.log(userObj);
      if (userObj[0].email != email) {
        const user = new User({
          name: req.body.name,
          email: email,
          password: req.body.password,
          emailToken: crypto.randomBytes(64).toString("hex"),
          status: "Inactive",
        });
        const salt = bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(user.password, salt);
        user.password = hashPassword;
        const newUser = await user.save();

        //send verification mail to user
        var mailoptions = {
          from: `"verify your email" <saiteja.5123@gmail.com`,
          to: user.email,
          subject: "verification email",
          html: `<h2>Thanks for Registering</h2>
            <h2>Please verify your mail to .. <h2>
            <a href="http://${req.headers.host}/user/verify-email?token=${user.emailToken}">click here</a>`,
        };

        // sending mail
        transporter.sendMail(mailoptions, function (error, info) {
          if (error) {
            console.log(error);
          } else {
            console.log("verfication email is sent to your gmail account");
          }
        });
        res.send("Sign up successful");
      } else {
        res.send("email is already registered");
      }
    } else {
      //   console.log("user not registered previosly");
      const user = new User({
        name: req.body.name,
        email: email,
        password: req.body.password,
        emailToken: crypto.randomBytes(64).toString("hex"),
        status: "Inactive",
      });
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(user.password, salt);
      user.password = hashPassword;
      const newUser = await user.save();

      //send verification mail to user
      var mailoptions = {
        from: `"verify your email" <saiteja.5123@gmail.com`,
        to: user.email,
        subject: "verification email",
        html: `<h2>Thanks for Registering</h2>
            <h2>Please verify your mail to .. <h2>
            <a href="http://${req.headers.host}/user/verify-email?token=${user.emailToken}">click here</a>`,
      };

      // sending mail
      transporter.sendMail(mailoptions, function (error, info) {
        if (error) {
          res.send(error);
        } else {
          console.log("verfication email is sent to your gmail account");
        }
      });
      res.send("Sign up successful");
    }
  });
});

//verify mail with email
app.get("/user/verify-email", async (req, res) => {
  try {
    const token = req.query.token;
    const user = await User.findOne({ emailToken: token });
    if (user) {
      user.emailToken = null;
      user.status = "Active";
      await user.save();
      res.send("Mail verified successfuly");
      console.log("Mail verified successfuly");
    } else {
      console.log("Mail is not verified");
    }
  } catch (error) {
    console.log(error);
  }
});

//sign in
app.post("/login", verifyEmail, async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const match = await bcrypt.compare(password, findUser.password);
      if (match) {
        //create token
        const token = createToken(findUser.id);
        // console.log("gettoken", token);
        //store token in cookie
        res.cookie("access-token", token);
        res.send({
          status: "login successful",
          user_id: findUser._id,
          user: findUser.name,
          email: findUser.email,
          token: token,
        });
      } else {
        console.log("Invalid password");
      }
    } else {
      console.log("User not registered");
    }
  } catch (error) {
    console.log(error);
  }
});

//signout
app.get("/signout", (req, res) => {
  res.cookie("access-token", "", { maxAge: 1 });
  res.send("signout successful");
});
//endpoint
// app.post("/upload/cloud", async (req, res) => {
//   const file = req.files.image;
//   const result = await cloudinary.uploader.upload(file.tempFilePath, {
//     public_id: `${Date.now()}`,
//     resource_type: "auto",
//     folder: "images",
//   });
//   res.json(result.url);
// });
//create a blog
app.post(
  "/createblog",
  [upload.fields([{ name: "image", maxCount: 1 }])],
  auth,
  async (req, res) => {
    const newBlog = new blogModel();
    try {
      let path = "/images";
      let uploadResponse2 = await uploadImages(req.files.image[0].buffer, path);
      console.log(uploadResponse2);
      newBlog.image = uploadResponse2.secure_url;
    } catch (error) {
      res.status(401).json({
        status: false,
        message: "image upload failed.",
        errors: error,
      });
      return;
    }

    newBlog.userid = req.body.userid;
    newBlog.title = req.body.title;
    newBlog.blogbody = req.body.blogbody;

    newBlog.save(function (err, blogObj) {
      if (err) {
        res.send({
          status: false,
          message: "request failed",
          error: err,
        });
        return;
      } else {
        res.send(blogObj);
      }
    });
  }
);

// Update a blog
app.put(
  "/updateblog/:id",
  [upload.fields([{ name: "image", maxCount: 1 }])],
  auth,
  async (req, res) => {
    let upid = req.params.id;
    let uptitle = req.body.title;
    let upblogbody = req.body.blogbody;
    // console.log("upid", upid);
    // console.log("file", req.files);
    if (req.files) {
      if (req.files.image != undefined) {
        blogModel.find({ _id: upid }, async (err, dataObj) => {
          if (err) {
            res.send(err);
          }
          console.log("obj", dataObj[0].image);
          let prevImage = dataObj[0].image;
          //   console.log(prevImage);
          const tempUrlArray1 = prevImage;
          //   console.log("tempUrlArray1", tempUrlArray1);
          const cloudinaryPublicId1 = tempUrlArray1
            .slice(tempUrlArray1.indexOf("images"), tempUrlArray1.length)
            .split(".")[0];
          console.log(cloudinaryPublicId1);
          try {
            let deleteResponse1 = await cloudinary.uploader.destroy(
              cloudinaryPublicId1
            );
            // console.log(deleteResponse1);
          } catch (error) {
            res.status(401).json({
              status: false,
              message: "Previous image delete failed.",
              errors: error,
            });
            return;
          }
          try {
            let path1 = "/images/";
            let uploadResponse1 = await uploadImages(
              req.files.image[0].buffer,
              path1
            );
            // console.log(uploadResponse1);
            var upimage = uploadResponse1.secure_url;
          } catch (error) {
            res.status(401).json({
              status: false,
              message: "image upload failed.",
              error: error,
            });
          }
          blogModel.findByIdAndUpdate(
            { _id: upid },
            { $set: { title: uptitle, blogbody: upblogbody, image: upimage } },
            { new: true },
            (err, data) => {
              if (err) {
                res.send(err);
              } else {
                res.send(data);
              }
            }
          );
        });
      } else {
        console.log("2");
      }
    } else {
      console.log("1");
    }
  }
);

// delete
app.delete("/delete/:id", auth, (req, res) => {
  let upid = req.params.id;
  blogModel.findOne({ _id: upid }, async (err, dataObj) => {
    if (err) {
      res.send(err);
    } else {
      //   console.log(dataObj.image);
      let image = dataObj.image;
      const tempUrlArray1 = image;
      const cloudinaryPublicId1 = tempUrlArray1
        .slice(tempUrlArray1.indexOf("images"), tempUrlArray1.length)
        .split(".")[0];
      // console.log(cloudinaryPublicId1);
      try {
        let deleteResponse1 = await cloudinary.uploader.destroy(
          cloudinaryPublicId1
        );
        // console.log(deleteResponse1);
      } catch (error) {
        res.status(401).json({
          status: false,
          message: "image delete failed.",
          errors: error,
        });
        return;
      }
      blogModel.deleteOne({ _id: upid }, (err, obj) => {
        if (err) {
          res.send(err);
        } else {
          res.send({ status: true, message: "Blog deleted sucessful" });
        }
      });
    }
  });
});

//get all blogs
app.get("/allblogs", (req, res) => {
  blogModel.find((err, obj) => {
    if (err) {
      res.send(err);
    } else {
      res.send(obj);
    }
  });
});

//get blog by id
app.get("/blog/:id", (req, res) => {
  let upid = req.params.id;
  blogModel.findById({ _id: upid }, (err, blogObj) => {
    if (err) {
      res.send(err);
    } else {
      res.send(blogObj);
    }
  });
});

//Get user blogs by user_id
app.get("/userblogs/:id", auth, (req, res) => {
  let user_id = req.params.id;
  blogModel.find({ userid: user_id }, (err, userblogs) => {
    if (err) {
      res.send(err);
    } else {
      res.send(userblogs);
    }
  });
});
app.listen(1800, () => {
  console.log("Started");
});
