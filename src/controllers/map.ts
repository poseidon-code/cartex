import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";

import Maps from "../data/maps.json" assert { type: "json" };

/**
 * `POST` : `/map/` \
 * Provides the list of all the registered map providers found inside 'maps.json'
 */
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

/**
 * `POST` : `/map/:id` \
 * Provides the registered map providers found inside 'maps.json' for the given `id`
 */
export const list_id = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const map = Maps.find((map) => map.id === id);

        if (!map) {
            return res.status(404).json(<BasicResponse>{
                method: "MAP",
                status: res.statusCode,
                message: `Map with ID : '${id}' not found.`,
            });
        }

        return res.status(200).json(map);
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "MAP",
            status: res.statusCode,
            message: `Internal Server Error : ${req.originalUrl}:list_id()`,
        });
    }
};
