import { Router } from "express";

import { tile_local } from "../controllers/tile.js";

const router = Router();

router.get("/local/:id", tile_local);

export default router;
