import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";
import Maps from "../data/maps.json" assert { type: "json" };
import UserMaps from "../data/user_maps.json" assert { type: "json" };

export type MapProvider = {
    provider: string;
    id: string;
    min_zoom: number;
    max_zoom: number;
    provider_url: string;
    extension: string;
};

export const RegisteredMaps: MapProvider[] = Maps as MapProvider[];
export const RegisteredUserMaps: MapProvider[] = UserMaps as MapProvider[];

/**
 * `GET` : `/map/` \
 * Provides the list of all the registered map providers found inside 'maps.json' & 'user_maps.json'
 */
export const list_all = async (req: Request, res: Response) => {
    try {
        const maps: MapProvider[] = [...RegisteredMaps, ...RegisteredUserMaps];
        return res.status(200).json(maps);
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
 * Provides the registered map providers found inside 'maps.json' & 'user_maps.json' for the given `id`
 */
export const list_id = async (req: Request, res: Response) => {
    try {
        const id: string = req.params.id;
        const maps: MapProvider[] = [...RegisteredMaps, ...RegisteredUserMaps];
        const map = maps.find((map) => map.id === id);

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

        const validate_provider_url = (url: string): boolean => {
            const regex = /\{x\}|\{y\}|\{z\}/g;
            const matches = url.match(regex);

            if (matches && matches.length === 3) {
                const unique_matches = new Set(matches);
                return unique_matches.size === 3;
            }

            return false;
        };

        // validate `provider_url`
        if (!validate_provider_url(new_map.provider_url)) {
            return res
                .status(400)
                .json(
                    <BasicResponse>{
                        method: "MAP",
                        status: res.statusCode,
                        message: `Invalid map provider URL`,
                    }
                ); // prettier-ignore
        }

        // append the new map provider
        RegisteredUserMaps.push(new_map);
        const file_path_1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/user_maps.json");
        fs.writeFileSync(file_path_1, JSON.stringify(RegisteredUserMaps, null, 4), "utf-8");

        if (process.env.NODE_ENV !== "production") {
            // copy over user map data to 'src/data/user_maps.json' only in development,
            // because when the server refreshes in 'tsc --watch' mode, it also resets the 'build/data/user_maps.json' file
            const file_path_2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/data/user_maps.json"); // prettier-ignore
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

/**
 * `DELETE`: `/map/:id`
 * Delete a map provider from 'user_maps.json'.
 */
export const delete_map = async (req: Request<{ id: string }, {}, {}>, res: Response) => {
    const id: string = req.params.id;

    if (!RegisteredUserMaps.some((map) => map.id === id)) {
        // check if the map with the given `id` exists
        return res
            .status(404)
            .json(
                <BasicResponse>{
                    method: "MAP",
                    status: res.statusCode,
                    message: `Map with ID : '${id}' doesn't exists`,
                }
            ); // prettier-ignore
    }

    const new_providers = RegisteredUserMaps.filter((map) => map.id !== id);

    // append the new map provider
    const file_path_1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/user_maps.json");
    fs.writeFileSync(file_path_1, JSON.stringify(new_providers, null, 4), "utf-8");

    if (process.env.NODE_ENV !== "production") {
        // copy over user map data to 'src/data/user_maps.json' only in development,
        // because when the server refreshes in 'tsc --watch' mode, it also resets the 'build/data/user_maps.json' file
        const file_path_2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/data/user_maps.json"); // prettier-ignore
        fs.writeFileSync(file_path_2, JSON.stringify(new_providers, null, 4), "utf-8");
    }

    return res
        .status(200)
        .json(
            <BasicResponse>{
                method: "MAP",
                status: res.statusCode,
                message: `Map provider with ID : '${id}' is deleted`
            }
        ); // prettier-ignore
};
