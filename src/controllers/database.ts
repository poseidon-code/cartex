import path from "node:path";
import fs from "node:fs";

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

/**
 *  {
 *      "top_left_coordinates" : {
 *          "latitude" : <value>,
 *          "longitude" : <value>
 *      },
 *      "bottom_right_coordinates" : {
 *          "latitude" : <value>,
 *          "longitude" : <value>
 *      },
 *      "zoom_levels" : {
 *          "from" : <value>,
 *          "to" : <value>
 *      } | {
 *          "at" : <value>
 *      }
 *  }
 */
type RequestBody = {
    top_left_coordinates: Coordinates;
    bottom_right_coordinates: Coordinates;
    zoom_levels: { from: ZoomLevel; to: ZoomLevel } | { at: ZoomLevel };
};

/**
 * Converts the latitude & longitude to tile number as per the given zoom level. \
 * Returns the `x` (column), `y` (row) & `z` (zoom level) of the tile in the world map.
 */
const tile_id = (coordinate: Coordinates, zoom: ZoomLevel): Tile => {
    const n: number = Math.pow(2, zoom);
    const latitude_radians = (coordinate.latitude * Math.PI) / 180.0;

    const x: number = n * ((coordinate.longitude + 180.0) / 360.0);
    const y: number = (n * (1.0 - Math.log(Math.tan(latitude_radians) + 1.0 / Math.cos(latitude_radians)) / Math.PI)) / 2.0; // prettier-ignore

    return {
        x: Math.floor(x),
        y: Math.floor(y),
        z: Math.floor(zoom),
    };
};

/**
 * Formats the tile provider URL with tile coordinates. \
 * Replaces `{x}`, `{y}` & `{z}` in the URL with given tile coordinates.
 */
const fetch_url = (url: string, tile: Tile): string => {
    return url
        .replace("{x}", tile.x.toString())
        .replace("{y}", tile.y.toString())
        .replace("{z}", tile.z.toString()); // prettier-ignore
};

/**
 * `POST` : `/database/:id` \
 * Downloads tiles for the requestd map `id` to the server's storage. \
 * Tiles are download for a regian bounded by the top-left corner coordinates & bottom-right corner coordinates \
 * of the bounded regian, either for a given zoom level or for a range of zoom levels.
 */
export const download_tiles_local = async (req: Request<{ id: string }, {}, RequestBody>, res: Response) => {
    try {
        const id = req.params.id; // retrieve the map `id` from request parameters

        const tiles_directory = process.env.TILES_DIRECTORY; // retrieve the map tiles directory of the server (environment variable)

        if (!tiles_directory) {
            // map tiles directory doesn't exits (i.e. `TILES_DIRECTORY` environment variable not set)
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "DATABASE",
                        status: res.statusCode,
                        message: `Path to tiles directory not found, set 'TILES_DIRECTORY' environment variable with path to map tiles directory.`,
                    }
                ); // prettier-ignore
        }

        const map = Maps.find((map) => map.id === id); // retrieve the map properties using map `id`

        if (!map) {
            // failed to find map properties for the given map `id`
            return res
                .status(404)
                .json(
                    <BasicResponse>{
                        method: "DATABASE",
                        status: res.statusCode,
                        message: `Tiles for the map with ID : '${id}' doesn't exists.`,
                    }
                ); // prettier-ignore
        }

        // retrieve the bounded region coordinates & zoom levels
        const { top_left_coordinates, bottom_right_coordinates, zoom_levels }: RequestBody = req.body;

        // determine the starting & ending zoom levels
        let start_zoom = 1;
        let end_zoom = 1;

        if ("at" in zoom_levels) {
            // `at` property exists, then starting & endig zoom levels are same
            start_zoom = zoom_levels.at;
            end_zoom = zoom_levels.at;
        } else {
            start_zoom = zoom_levels.from;
            end_zoom = zoom_levels.to;
        }

        if (end_zoom >= map.max_zoom || start_zoom <= map.min_zoom) {
            // validate the zoom levels for that map
            return res
                .status(401)
                .json(
                    <BasicResponse>{
                        method: "DATABASE",
                        status: res.statusCode,
                        message: `Invalid zoom level (start, end) : '(${start_zoom}, ${end_zoom})', 
                                 valid zoom level range for '${map.provider} (${map.id})' is [${map.min_zoom} - ${map.max_zoom}]`,
                    }
                ); // prettier-ignore
        }

        let fetch_tile_promises = []; // for holding fetch requests of all tile images

        // if range of zoom levels is passed (i.e. `from` & `to` properties present)
        for (let z = start_zoom; z <= end_zoom; z++) {
            const start_tile: Tile = tile_id(top_left_coordinates, z); // get the positions of the starting tile at this zoom level
            const end_tile: Tile = tile_id(bottom_right_coordinates, z); // get the positions of the starting tile at this zoom level

            for (let y = start_tile.y; y <= end_tile.y; y++) {
                for (let x = start_tile.x; x <= end_tile.x; x++) {
                    // create the complete tiles directory path as per the tile coordinates, i.e.
                    // `/<TILES_DIRECTORY>/<MAP_ID>/<ZOOM_LEVEL>/<Y>/`
                    const tile_directory = path.join(tiles_directory, map.id, z.toString(), y.toString());

                    // create the complete tile path at current position of `x` & `y` values
                    // `/<TILES_DIRECTORY>/<MAP_ID>/<ZOOM_LEVEL>/<Y>/<ZOOM_LEVEL>_<Y>_<X>.<FILE_EXTENSION>
                    const tile_path = path.join(tile_directory, `${z}_${y}_${x}.${map.extension}`);

                    if (!fs.existsSync(tile_path)) {
                        // if the tile image doesn't exists, create the directory of that tile
                        if (!fs.existsSync(tile_directory)) fs.mkdirSync(tile_directory, { recursive: true });

                        // format the tile provider URL for the map with the tile's `x`, `y`, & `z` positions
                        const tile_url = fetch_url(map.provider_url, { x, y, z });

                        // add a fetch promise for the tile from the provider
                        fetch_tile_promises.push(
                            await fetch(tile_url).then(async (fetch_response) => {
                                if (fetch_response.ok) {
                                    // save the successfully fetched image to server's storage
                                    const data = await fetch_response.arrayBuffer();
                                    const buffered_data = Buffer.from(data);

                                    fs.writeFile(tile_path, buffered_data, (write_error) => {
                                        if (write_error) {
                                            // failed to save the tile image
                                            return res
                                                .status(400)
                                                .json(
                                                    <BasicResponse>{
                                                        method: "DATABASE",
                                                        status: res.statusCode,
                                                        message: `Error saving the tile image (${z}_${y}_${x}.${map.extension})`,
                                                    }
                                                ); // prettier-ignore
                                        }
                                    });
                                } else {
                                    // failed to fetch the tile image
                                    return res
                                        .status(400)
                                        .json(
                                            <BasicResponse>{
                                                method: "DATABASE",
                                                status: res.statusCode,
                                                message: `Error downloading the tile image (${z}_${y}_${x}.${map.extension})`,
                                            }
                                        ); // prettier-ignore
                                }
                            })
                        );
                    }
                }
            }
        }

        // fetch all the tiles concurrently
        await Promise.all(fetch_tile_promises);

        // all tile images have downloaded successfully
        return res
            .status(200)
            .json(
                <BasicResponse>{
                    method: "DATABASE",
                    status: res.statusCode,
                    message: `All tiles were added`,
                }
            ); // prettier-ignore
    } catch (error) {
        process.env.NODE_ENV !== "production" && console.error(error);

        return res
            .status(500)
            .json(
                <BasicResponse>{
                    method: "DATABASE",
                    status: res.statusCode,
                    message: `Internal Server Error : ${req.originalUrl}:download_tiles_local()`,
                }
            ); // prettier-ignore
    }
};
