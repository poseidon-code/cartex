import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";

import Maps from "../data/maps.json";

export const list_all = async (req: Request, res: Response) => {
    try {
        return res.status(200).json(Maps);
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "MAP",
            status: res.statusCode,
            message: `Internal Server Error : ${req.originalUrl}:list_all()`,
        });
    }
};
