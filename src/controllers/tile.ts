import path from "node:path";
import fs from "node:fs";

import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";
import { MapProvider, RegisteredMaps, RegisteredUserMaps } from "./map.js";

export const tile_local = async (
    req: Request<{ id: string }, {}, { x: string; y: string; z: string }>,
    res: Response
) => {
    try {
        const id = req.params.id;

        if (typeof req.query.x !== "string" || typeof req.query.y !== "string" || typeof req.query.z !== "string") {
            // check if all the required query parameters are passed in
            return res
                .status(400)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Invalid query parameters ${JSON.stringify(req.query).replaceAll('"', "'")}, required '{z, y, x}'`
                    }
                ); // prettier-ignore
        }

        const tiles_directory = process.env.TILES_DIRECTORY;

        if (!tiles_directory) {
            // check for 'TILE_DIRECTORY' environment variable
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Path to tiles directory not found, set 'TILES_DIRECTORY' environment variable with path to map tiles directory.`,
                    }
                ); // prettier-ignore
        }

        const maps: MapProvider[] = [...RegisteredMaps, ...RegisteredUserMaps];
        const map = maps.find((map) => map.id === id);

        if (!map) {
            // check if map provider with `id` is registered
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Tiles for the map provider with ID : '${id}' may not be registered in 'data/maps.json' or 'data/user_maps.json' (not found)`,
                    }
                ); // prettier-ignore
        }

        const tile_id_directory = path.join(tiles_directory, id);

        try {
            if (!fs.statSync(tile_id_directory).isDirectory()) {
                throw Error();
            }
        } catch {
            // handle error thrown by 'fs.statSync()' when directory doesn't exists
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Tiles directory for the map with ID : '${id}' doesn't exists or not a directory.`,
                    }
                ); // prettier-ignore
        }

        const z = req.query.z;
        const y = req.query.y;
        const x = req.query.x;

        if (+z > map.max_zoom || +z < map.min_zoom) {
            // check for valid zoom level for the map provider with `id`
            return res
                .status(401)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Invalid zoom level (z) : '${z}', valid zoom level range for '${map.provider} (${map.id})' is [${map.min_zoom} - ${map.max_zoom}].`,
                    }
                ); // prettier-ignore
        }

        // create absolute path to that tile image
        const tile_path = path.join(tile_id_directory, z, y, `${z}_${y}_${x}.${map.extension}`);

        try {
            if (fs.statSync(tile_path).isFile()) {
                // chcek if the tile image exists and is a file
                return res.status(200).sendFile(tile_path);
            } else {
                throw Error();
            }
        } catch {
            // handle error thrown by 'fs.statSync()' when file doesn't exists
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Tile for coordinates '{z:${z} , y:${y} , x:${x}}' doesn't exists or not a file (not found)`,
                    }
                ); // prettier-ignore
        }
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "TILE",
            status: res.statusCode,
            message: `Internal Server Error : ${req.originalUrl}:tile_local()`,
        });
    }
};

export const tile_provider = async (req: Request, res: Response) => {
    try {
        const slug = req.url.match(/\/provider\/(.*)/);

        const url = (slug && slug[1]) ?? undefined;

        if (url) {
            let content_type: string = "image/jpg";

            const image_buffer = await fetch(url).then(async (fres) => {
                if (fres.ok) {
                    const data = await fres.arrayBuffer();
                    content_type = fres.headers.get("content-type") ?? "image/jpg";

                    return Buffer.from(data);
                } else {
                    return res.status(400).json(<BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Error fetching the tile image from '${url}'`,
                    });
                }
            });

            if (image_buffer) {
                return res.status(200).set("Content-Type", content_type).send(image_buffer);
            }
        } else {
            return res.status(400).json(<BasicResponse>{
                method: "TILE",
                status: res.statusCode,
                message: `No provider URL passed.`,
            });
        }
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "TILE",
            status: res.statusCode,
            message: `Internal Server Error : /tile/provider/*:tile_provider()`,
        });
    }
};
