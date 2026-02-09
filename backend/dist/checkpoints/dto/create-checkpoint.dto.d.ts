export declare enum CheckpointType {
    VIEWPOINT = "viewpoint",
    WATER_SOURCE = "water_source",
    CAMPSITE = "campsite",
    LANDMARK = "landmark",
    SUMMIT = "summit",
    SHELTER = "shelter",
    BRIDGE = "bridge",
    PASS = "pass",
    LAKE = "lake",
    WATERFALL = "waterfall",
    RUINS = "ruins",
    CHURCH = "church",
    TOWER = "tower"
}
export declare class CreateCheckpointDto {
    trail_id: string;
    name_en: string;
    name_ka?: string;
    description_en?: string;
    description_ka?: string;
    type: CheckpointType;
    coordinates: [number, number];
    elevation_m?: number;
    photo_url?: string;
    sort_order?: number;
    is_checkable?: boolean;
}
