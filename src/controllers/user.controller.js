import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';

//Generate Access and Refresh Token Controller
const generateAccessAndRefreshToken = async (userId) => {
  try {

    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
  
    user.refreshToken = refreshToken;
  
    await user.save({validateBefore: false});

    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(500, 'Something went wrong while generating access token and refresh token')
  }
  
}


//User Registration Controller
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res
  const { username, email, password, fullName } = req.body;
  if (
    [username, email, password, fullName].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required!");
  }

  const existedUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists!");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  // const coverImageLocalPath = req.file.coverImage[ 0 ]?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required!");
  }
  console.log("Uploading avatar to Cloudinary:", avatarLocalPath);

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    console.error("Avatar upload to Cloudinary failed:", avatar);
    throw new ApiError(400, "Avatar file is required!");
  }

  console.log("Avatar uploaded successfully:", avatar);

  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
    email,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user!");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
})


//User Login Controller
const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  //find the user
  //password check
  //access and referesh token
  //send cookie
  const { username, email, password } = req.body;
  // console.log(req.body);
  if (!username && !email) {
    throw new ApiError(403, "username or email is required!");
  }

  const user = await User.findOne({
    $or: [ { username: username }, { email: email } ]
  });

  if (!user) {
    throw new ApiError(403, "User does not exist!");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(403, "Password is incorrect!");
  }

  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id);
  // console.log(refreshToken, accessToken);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
    .cookie('refreshToken', refreshToken, options)
    .cookie('accessToken', accessToken, options)
    .json(
      new ApiResponse(200, {
        user: loggedInUser, refreshToken, accessToken
      },
        "User logged in successfully!"
      )
    )
})


//User Logout Controller
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  );

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"))
})


//Refresh Access Token Controller
const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingToken = req.cookies.refreshToken || req.body.refreshToken;
  
    if (!incomingToken) {
      throw new ApiError(403, "Unauthorized request!")
    }
  
    const decodeToken = jwt.verify(
      incomingToken,
      process.env.REFRESH_TOKEN_SECRET
    );
  
    const user = await User.findById(decodeToken?._id)
  
    if (incomingToken !== user?.refreshToken) {
      throw new ApiError(500, "Access token is used or expired!")
    }
  
    const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(
      user?._id
    );
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    return res
      .status(200)
      .cookie("refreshToken", newRefreshToken, options)
      .cookie("accessToken", accessToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken: accessToken, refreshToken: newRefreshToken },
          "Access Token refreshed successfully!"
        )
      );
    
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token!")
  }
})


//Change Current Password Controller
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // console.log(req.cookies);

  if (oldPassword === newPassword) {
    throw new ApiError(401, "Old and new password should not be same!")
  }

  const refreshToken = req.cookies.refreshToken;

  const decodeToken = jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodeToken?._id);
    // console.log(user);
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  const correctPassword = await user.isPasswordCorrect(oldPassword);

  if (!correctPassword) {
    throw new ApiError(401, "Password does not match");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(new ApiError(200, {}, "Password updated successfully!"));

})


//Get Current User Controller
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;
  // console.log(user);

  return res
    .status(200)
    .json(new ApiResponse(
      200,
      user,
      "User fetched successfully!"
    ));
})


//Update Account Details Controller
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, username } = req.body;

  if (!username || !fullName) {
    throw new ApiError(400, "Username or full name is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        username: username.toLowerCase()
      }
    }
  )

  const updatedUser = await User.findById(user?._id).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Account updated successfully!"));
});


//Update User Avatar Controller
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  // console.log(avatarLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing!");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  );

  const updatedUser = await User.findById(user?._id).select("-password");

  res.status(201).json(new ApiResponse(200, updatedUser, "Avatar updated successfully!"))

})

//Update Cover Image Controller
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  console.log(coverImageLocalPath);

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image not found!")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(404, 'Error while uploading cover image')
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
      coverImage: coverImage.url
    }
    }, {
      new: true
    }
  )

  const updatedUser = await User.findById(user?._id);

  res.status(201).json(new ApiResponse(200, updatedUser, "Successfully updated cover image!"))
})

export {
  generateAccessAndRefreshToken,
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};