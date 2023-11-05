import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import helmet from "helmet";
import express, { Response } from "express";

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

app.get("/", async (_, res: Response) => {
    try {
        return res.status(200).json({
            method: "SERVER",
            status: res.statusCode,
            message: "Server OK",
        });
    } catch (error) {
        return res.status(500).json({
            method: "SERVER",
            status: res.statusCode,
            message: "Server Not OK",
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server Running : http://localhost:${PORT}`);
});
