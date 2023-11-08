import { Router } from "express";

import { list_all } from "../controllers/map.js";

const router = Router();

router.get("/", list_all);

export default router;
