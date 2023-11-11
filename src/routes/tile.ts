import { Router } from "express";

import { tile_local, tile_provider } from "../controllers/tile.js";

const router = Router();

router.get("/local/:id", tile_local);
router.get("/provider/*", tile_provider);

export default router;
