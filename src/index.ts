import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import helmet from "helmet";
import express, { Response } from "express";

import type { BasicResponse } from "./models/BasicResponse.d.ts";

import MapRoutes from "./routes/map.js";

const PORT = process.env.PORT || 5000;

const app = express();
app.use(
    cors({
        origin: "*",
    })
);
app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);
app.use(express.json());
app.disable("x-powered-by");

app.use("/map", MapRoutes);

app.get("/", async (_, res: Response) => {
    try {
        return res.status(200).json(<BasicResponse>{
            method: "SERVER",
            status: res.statusCode,
            message: "Server OK",
        });
    } catch (error) {
        return res.status(500).json(<BasicResponse>{
            method: "SERVER",
            status: res.statusCode,
            message: "Server Not OK",
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server Running : http://localhost:${PORT}`);
});
