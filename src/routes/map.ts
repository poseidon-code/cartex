import { Router } from "express";

import { list_all, list_id } from "../controllers/map.js";

const router = Router();

router.get("/", list_all);
router.get("/:id", list_id);

export default router;
