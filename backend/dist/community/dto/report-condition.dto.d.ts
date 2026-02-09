export declare enum ConditionType {
    TRAIL_CLEAR = "trail_clear",
    MUDDY = "muddy",
    SNOW = "snow",
    FALLEN_TREE = "fallen_tree",
    FLOODED = "flooded",
    OVERGROWN = "overgrown",
    DAMAGED = "damaged",
    CLOSED = "closed"
}
export declare enum SeverityLevel {
    INFO = "info",
    WARNING = "warning",
    DANGER = "danger"
}
export declare class ReportConditionDto {
    trail_id: string;
    condition_type: ConditionType;
    severity: SeverityLevel;
    description?: string;
    photo_url?: string;
}
