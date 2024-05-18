import { Router } from "express";

import { download_tiles } from "../controllers/database.js";

const router = Router();

router.post("/:id", download_tiles);

export default router;
