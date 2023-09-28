const HttpError = require('../modals/http-error');
const {v4: uuid} = require('uuid');
const { validationResult } = require('express-validator');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../modals/user');


const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, '-password');
  } catch (err) {
    const error = new HttpError('Fetching user failed!', 500);
    return next(error); 
  }
  res.json({ users: users.map(user => user.toObject({getters: true})) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new HttpError('Invalid Input!', 422);
    return next(error);
  }

  const { name, email, password } = req.body;

  // const hasUser = DUMMY_USERS.find(u => u.email === email);
  // if (hasUser) {
  //   throw new HttpError('Could not create user, email already exists.', 422);
  // }

  let existingUser;

  try {
    existingUser = await User.findOne({email: email});
  } catch (err) {
    const error = new HttpError('Signing up failed, please try again later', 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError('User exists already', 422);
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError('Could not create user, please try again', 500);
    return next(error);
  }
  
  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: []
  });

  // DUMMY_USERS.push(createdUser);
  try {
    await createdUser.save();
  } catch (err) {
      const error = new HttpError('Signing up failed!', 500); 
      return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email }, 
      process.env.JWT_KEY,
      { expiresIn: '1h' } 
    )
  } catch (err) {
    const error = new HttpError('Signing up failed!', 500); 
    return next(error);
  }
  

  res.status(201).json({userId: createdUser.id, email: createdUser.email, token: token});
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    existingUser = await User.findOne({email: email});
  } catch (err) {
    const error = new HttpError('Loging in failed, please try again later', 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError('Could not identify user, credentials seem to be wrong.', 403);
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError('Could not logged in, Please check your credentials', 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError('Could not identify user, credentials seem to be wrong.', 401);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email }, 
      process.env.JWT_KEY,
      { expiresIn: '1h' } 
    )
  } catch (err) {
    const error = new HttpError('logging in failed!', 500); 
    return next(error);
  }

  res.json({
    userId: existingUser.id, email: existingUser.email, token: token
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;