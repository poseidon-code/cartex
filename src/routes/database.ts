import { Router } from "express";

import { download_tiles_local } from "../controllers/database.js";

const router = Router();

router.post("/local/:id", download_tiles_local);

export default router;
