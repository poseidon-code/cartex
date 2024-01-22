export type BasicResponse = {
    method: "SERVER" | "MAP" | "TILE" | "DATABASE";
    status: number;
    message: string;
};
