import express from 'express';
import { signup, login, logout, checkAuth, checkUsernameAvailability } from '../controllers/authController';
import { protectRoute } from '../middleware/protectRoute';

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/check", protectRoute, checkAuth);
router.get("/check-username", checkUsernameAvailability);

export default router;