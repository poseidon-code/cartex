import path from "path";
import fs from "fs";

import { Request, Response } from "express";

import type { BasicResponse } from "../models/BasicResponse.js";
import Maps from "../data/maps.json";

type Coordinates = {
    latitude: number;
    longitude: number;
};

type ZoomLevel = number;

type Tile = {
    x: number;
    y: number;
    z: ZoomLevel;
};

type RequestBody = {
    top_left_coordinates: Coordinates;
    bottom_right_coordinates: Coordinates;
    zoom_levels: { from: ZoomLevel; to: ZoomLevel } | { at: ZoomLevel };
};

const tile_id = (coordinate: Coordinates, zoom: ZoomLevel): Tile => {
    const n: number = Math.pow(2, zoom);
    const latitude_radians = (coordinate.latitude * Math.PI) / 180.0;

    const x: number = n * ((coordinate.longitude + 180.0) / 360.0);
    const y: number =
        (n * (1.0 - Math.log(Math.tan(latitude_radians) + 1.0 / Math.cos(latitude_radians)) / Math.PI)) / 2.0;

    return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(zoom) };
};

const fetch_url = (url: string, tile: Tile): string => {
    return url.replace("{x}", tile.x.toString()).replace("{y}", tile.y.toString()).replace("{z}", tile.z.toString());
};

export const download_tiles_local = async (req: Request<{ id: string }, {}, RequestBody>, res: Response) => {
    try {
        const { top_left_coordinates, bottom_right_coordinates, zoom_levels }: RequestBody = req.body;

        if ("at" in zoom_levels) {
            const start_tile: Tile = tile_id(top_left_coordinates, zoom_levels.at);
            const end_tile: Tile = tile_id(bottom_right_coordinates, zoom_levels.at);

            for (let y = start_tile.y; y <= end_tile.y; y++) {
                for (let x = start_tile.x; x <= end_tile.x; x++) {
                    const id = req.params.id;

                    const tiles_directory = process.env.TILES_DIRECTORY;

                    if (!tiles_directory) {
                        return res.status(404).json(<BasicResponse>{
                            method: "DATABASE",
                            status: res.statusCode,
                            message: `Path to tiles directory not found, set 'TILES_DIRECTORY' environment variable with path to map tiles directory.`,
                        });
                    }

                    const map = Maps.find((map) => map.id === id);

                    if (map) {
                        if (zoom_levels.at > map.max_zoom || zoom_levels.at < map.min_zoom) {
                            return res.status(401).json(<BasicResponse>{
                                method: "DATABASE",
                                status: res.statusCode,
                                message: `Invalid zoom level (z) : '${zoom_levels.at}', valid zoom level range for '${map.provider} (${map.id})' is [${map.min_zoom} - ${map.max_zoom}].`,
                            });
                        }

                        const tile_directory = path.join(
                            tiles_directory,
                            map.id,
                            zoom_levels.at.toString(),
                            y.toString()
                        );

                        const tile_path = path.join(tile_directory, `${zoom_levels.at}_${y}_${x}.${map.extension}`);

                        if (!fs.existsSync(tile_path)) {
                            if (!fs.existsSync(tile_directory)) fs.mkdirSync(tile_directory, { recursive: true });

                            const tile_url = fetch_url(map.provider_url, { x, y, z: zoom_levels.at });

                            await fetch(tile_url).then(async (fres) => {
                                if (fres.ok) {
                                    const data = await fres.arrayBuffer();
                                    fs.writeFileSync(tile_path, Buffer.from(data));
                                } else {
                                    return res.status(400).json(<BasicResponse>{
                                        method: "DATABASE",
                                        status: res.statusCode,
                                        message: `Error downloading the tile image from '${map.provider_url}'`,
                                    });
                                }
                            });
                        }
                    } else {
                        return res.status(404).json(<BasicResponse>{
                            method: "DATABASE",
                            status: res.statusCode,
                            message: `Tiles for the map with ID : '${id}' doesn't exists.`,
                        });
                    }
                }
            }
        } else {
            for (let z = zoom_levels.from; z <= zoom_levels.to; z++) {
                const start_tile: Tile = tile_id(top_left_coordinates, z);
                const end_tile: Tile = tile_id(bottom_right_coordinates, z);

                for (let y = start_tile.y; y <= end_tile.y; y++) {
                    for (let x = start_tile.x; x <= end_tile.x; x++) {
                        const id = req.params.id;

                        const tiles_directory = process.env.TILES_DIRECTORY;

                        if (!tiles_directory) {
                            return res.status(404).json(<BasicResponse>{
                                method: "DATABASE",
                                status: res.statusCode,
                                message: `Path to tiles directory not found, set 'TILES_DIRECTORY' environment variable with path to map tiles directory.`,
                            });
                        }

                        const map = Maps.find((map) => map.id === id);

                        if (map) {
                            if (z > map.max_zoom || z < map.min_zoom) {
                                return res.status(401).json(<BasicResponse>{
                                    method: "DATABASE",
                                    status: res.statusCode,
                                    message: `Invalid zoom level (z) : '${z}', valid zoom level range for '${map.provider} (${map.id})' is [${map.min_zoom} - ${map.max_zoom}].`,
                                });
                            }

                            const tile_directory = path.join(tiles_directory, map.id, z.toString(), y.toString());

                            const tile_path = path.join(tile_directory, `${z}_${y}_${x}.${map.extension}`);

                            if (!fs.existsSync(tile_path)) {
                                if (!fs.existsSync(tile_directory)) fs.mkdirSync(tile_directory, { recursive: true });

                                const tile_url = fetch_url(map.provider_url, { x, y, z });

                                await fetch(tile_url).then(async (fres) => {
                                    if (fres.ok) {
                                        const data = await fres.arrayBuffer();
                                        fs.writeFileSync(tile_path, Buffer.from(data));
                                    } else {
                                        return res.status(400).json(<BasicResponse>{
                                            method: "DATABASE",
                                            status: res.statusCode,
                                            message: `Error downloading the tile image from '${map.provider_url}'`,
                                        });
                                    }
                                });
                            }
                        } else {
                            return res.status(404).json(<BasicResponse>{
                                method: "DATABASE",
                                status: res.statusCode,
                                message: `Tiles for the map with ID : '${id}' doesn't exists.`,
                            });
                        }
                    }
                }
            }
        }

        return res.status(200).json(<BasicResponse>{
            method: "DATABASE",
            status: res.statusCode,
            message: `All tiles were added`,
        });
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res.status(500).json(<BasicResponse>{
            method: "DATABASE",
            status: res.statusCode,
            message: `Internal Server Error : ${req.originalUrl}:download_tiles_local()`,
        });
    }
};
