import { TrailsService } from './trails.service';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';
export declare class TrailsController {
    private trailsService;
    constructor(trailsService: TrailsService);
    findAll(filter: TrailFilterDto): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getRegions(): Promise<any[]>;
    findNearby(query: NearbyQueryDto): Promise<any>;
    findOne(id: string): Promise<any>;
    create(dto: CreateTrailDto): Promise<any>;
    update(id: string, dto: UpdateTrailDetailsDto): Promise<any>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
