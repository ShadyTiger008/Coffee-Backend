import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

//User Resgistration Route
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);
//User Login Route
router.route('/login').post(loginUser);

/*Secured Routes*/

//User Logout Route
router.route('/logout').get(verifyJwt, logoutUser);
//Refresh Token Route
router.route('/refresh-token').get(verifyJwt, refreshAccessToken);
//CHange Password Route
router.route('/change-password').patch(verifyJwt, changeCurrentPassword);
//Get User Route
router.route('/get-current-user').get(verifyJwt, getCurrentUser);
//Update Account Details Route
router.route('/update-account').patch(verifyJwt, updateAccountDetails);
//Update User Avatar Route
router.route("/update-avatar").patch(verifyJwt, upload.single("avatar"), updateUserAvatar);
//Update User Cover Image Route
router.route('/update-cover-image').patch(verifyJwt, upload.single("coverImage"), updateUserCoverImage);

export default router;