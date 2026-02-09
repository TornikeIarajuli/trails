import { SupabaseService } from '../config/supabase.config';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';
export declare class TrailsService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    create(dto: CreateTrailDto): Promise<any>;
    findAll(filter: TrailFilterDto): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<any>;
    updateDetails(id: string, dto: UpdateTrailDetailsDto): Promise<any>;
    remove(id: string): Promise<{
        message: string;
    }>;
    findNearby(query: NearbyQueryDto): Promise<any>;
    getRegions(): Promise<any[]>;
}
