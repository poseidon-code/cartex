import { Router } from "express";

import { list_all, list_id, add_map, delete_map } from "../controllers/map.js";

const router = Router();

router.get("/", list_all);
router.get("/:id", list_id);
router.post("/", add_map);
router.delete("/:id", delete_map);

export default router;
