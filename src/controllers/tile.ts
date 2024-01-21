import path from "path";
import fs from "fs";

import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.d.ts";
import Maps from "../data/maps.json";

export const tile_local = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const tiles_directory = process.env.TILES_DIRECTORY;

        if (!tiles_directory) {
            return res.status(404).json(<BasicResponse>{
                method: "TILE",
                status: res.statusCode,
                message: `Path to tiles directory not found, set 'TILES_DIRECTORY' environment variable with path to map tiles directory.`,
            });
        }

        const tile_id_directory = path.join(tiles_directory, id);

        try {
            const map = Maps.find((map) => map.id === id);

            if (fs.statSync(tile_id_directory).isDirectory()) {
                if (map) {
                    const z = req.query.z as string | undefined;
                    const y = req.query.y as string | undefined;
                    const x = req.query.x as string | undefined;

                    if (z && y && x) {
                        if (+z > map.max_zoom || +z < map.min_zoom) {
                            return res.status(401).json(<BasicResponse>{
                                method: "TILE",
                                status: res.statusCode,
                                message: `Invalid zoom level (z) : '${z}', valid zoom level range for '${map.provider} (${map.id})' is [${map.min_zoom} - ${map.max_zoom}].`,
                            });
                        }

                        const tile_path = path.join(tile_id_directory, z, y, `${z}_${y}_${x}.${map.extension}`);

                        try {
                            if (fs.statSync(tile_path).isFile()) {
                                return res.status(200).sendFile(tile_path);
                            } else {
                                return res.status(404).json(<BasicResponse>{
                                    method: "TILE",
                                    status: res.statusCode,
                                    message: `Tile for coordinates '{z:${z} , y:${y} , x:${x}}' doesn't exists or not a file.`,
                                });
                            }
                        } catch (error) {
                            return res.status(404).json(<BasicResponse>{
                                method: "TILE",
                                status: res.statusCode,
                                message: `Tile for coordinates '{z:${z} , y:${y} , x:${x}}' doesn't exists.`,
                            });
                        }
                    } else {
                        return res.status(400).json(<BasicResponse>{
                            method: "TILE",
                            status: res.statusCode,
                            message: `Invalid query parameters ${JSON.stringify(req.query).replaceAll('"', "'")}, required '{z, y, x}'`, // prettier-ignore
                        });
                    }
                } else {
                    return res.status(501).json(<BasicResponse>{
                        method: "TILE",
                        status: res.statusCode,
                        message: `Tiles for the map with ID : '${id}' exists but not indexed in 'data/maps.json'`,
                    });
                }
            } else {
                return res.status(404).json(<BasicResponse>{
                    method: "TILE",
                    status: res.statusCode,
                    message: `Tiles for the map with ID : '${id}' doesn't exists or not a directory.`,
                });
            }
        } catch (error) {
            return res.status(404).json(<BasicResponse>{
                method: "TILE",
                status: res.statusCode,
                message: `Tiles for the map with ID : '${id}' doesn't exists.`,
            });
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
