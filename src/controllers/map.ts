import fs from "node:fs";
import path from "node:path";

import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";

import Maps from "../data/maps.json" assert { type: "json" };
import UserMaps from "../data/user_maps.json" assert { type: "json" };
import { fileURLToPath } from "node:url";

type MapProvider = {
    provider: string;
    id: string;
    min_zoom: number;
    max_zoom: number;
    provider_url: string;
    extension: string;
};

const RegisteredMaps: MapProvider[] = Maps as MapProvider[];
const RegisteredUserMaps: MapProvider[] = UserMaps as MapProvider[];

/**
 * `GET` : `/map/` \
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
 * `GET` : `/map/:id` \
 * Provides the registered map providers found inside 'maps.json' for the given `id`
 */
export const list_id = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const map = RegisteredMaps.find((map) => map.id === id);

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

/**
 * `POST`: `/map/`
 * Add a new map provider into 'user_maps.json'.
 */
export const add_map = async (req: Request<{}, {}, MapProvider>, res: Response) => {
    try {
        const new_map: MapProvider = req.body;

        if (
            typeof new_map.id !== "string" ||
            typeof new_map.provider !== "string" ||
            typeof new_map.provider_url !== "string" ||
            typeof new_map.max_zoom !== "number" ||
            typeof new_map.min_zoom !== "number" ||
            typeof new_map.extension !== "string"
        ) {
            // check for all required pramaeters to be present in request body
            return res
                .status(400)
                .json(
                    <BasicResponse>{
                        method: "MAP",
                        status: res.statusCode,
                        message: "Missing some required map provider parameters"
                    }
                ) // prettier-ignore
        }

        if (
            RegisteredMaps.some((map) => map.id === new_map.id) ||
            RegisteredUserMaps.some((map) => map.id === new_map.id)
        ) {
            // check if the new map with `id` already exists
            return res
                .status(400)
                .json(
                    <BasicResponse>{
                        method: "MAP",
                        status: res.statusCode,
                        message: `Map with ID : '${new_map.id}' is already present`,
                    }
                ); // prettier-ignore
        }

        // append the new map provider
        RegisteredUserMaps.push(new_map);
        const file_path_1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/user_maps.json");
        fs.writeFileSync(file_path_1, JSON.stringify(RegisteredUserMaps, null, 4), "utf-8");

        if (process.env.NODE_ENV === "development") {
            // copy over user map data to 'src/data' only in development,
            // because when the server refreshes in 'tsc --watch' mode, it also resets the 'build/data/user_maps.json' file
            const file_path_2 = path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                "../../src/data/user_maps.json"
            );
            fs.writeFileSync(file_path_2, JSON.stringify(RegisteredUserMaps, null, 4), "utf-8");
        }

        return res
            .status(200)
            .json(
                <BasicResponse>{
                    method: "MAP",
                    status: res.statusCode,
                    message: "New map provider added"
                }
            ); // prettier-ignore
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "MAP",
            status: res.statusCode,
            message: `Internal Server Error : ${req.originalUrl}:add_map()`,
        });
    }
};
