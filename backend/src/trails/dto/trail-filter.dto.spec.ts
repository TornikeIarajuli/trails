import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TrailFilterDto, NearbyQueryDto } from './trail-filter.dto';

// Helpers
async function checkFilter(plain: object) {
  return validate(plainToInstance(TrailFilterDto, plain));
}

async function checkNearby(plain: object) {
  return validate(plainToInstance(NearbyQueryDto, plain));
}

const errorProps = (errors: Awaited<ReturnType<typeof validate>>) =>
  errors.map((e) => e.property);

// ---------------------------------------------------------------------------
// TrailFilterDto
// ---------------------------------------------------------------------------
describe('TrailFilterDto', () => {
  it('accepts an entirely empty object (all fields optional)', async () => {
    expect(await checkFilter({})).toHaveLength(0);
  });

  it('accepts a fully populated valid object', async () => {
    const errors = await checkFilter({
      page: 1,
      limit: 20,
      difficulty: 'easy',
      region: 'Kazbegi',
      search: 'ridge',
      min_distance: 5,
      max_distance: 30,
    });
    expect(errors).toHaveLength(0);
  });

  // difficulty
  describe('difficulty', () => {
    it.each(['easy', 'medium', 'hard', 'ultra'])(
      'accepts difficulty = "%s"',
      async (diff) => {
        const errors = await checkFilter({ difficulty: diff });
        expect(errors.filter((e) => e.property === 'difficulty')).toHaveLength(
          0,
        );
      },
    );

    it('rejects an unknown difficulty value', async () => {
      const errors = await checkFilter({ difficulty: 'extreme' });
      expect(errorProps(errors)).toContain('difficulty');
    });

    it('rejects an empty string as difficulty', async () => {
      const errors = await checkFilter({ difficulty: '' });
      expect(errorProps(errors)).toContain('difficulty');
    });
  });

  // region
  describe('region', () => {
    it('accepts a plain region string', async () => {
      const errors = await checkFilter({ region: 'Svaneti' });
      expect(errors.filter((e) => e.property === 'region')).toHaveLength(0);
    });

    it('accepts region with spaces and Unicode', async () => {
      const errors = await checkFilter({ region: 'სვანეთი' });
      expect(errors.filter((e) => e.property === 'region')).toHaveLength(0);
    });
  });

  // search
  describe('search', () => {
    it('accepts any non-empty string', async () => {
      const errors = await checkFilter({ search: 'kazbegi peak' });
      expect(errors.filter((e) => e.property === 'search')).toHaveLength(0);
    });
  });

  // min_distance
  describe('min_distance', () => {
    it('accepts min_distance = 0 (boundary)', async () => {
      const errors = await checkFilter({ min_distance: 0 });
      expect(errors.filter((e) => e.property === 'min_distance')).toHaveLength(
        0,
      );
    });

    it('accepts min_distance as a string — @Type converts it', async () => {
      const errors = await checkFilter({ min_distance: '5' });
      expect(errors.filter((e) => e.property === 'min_distance')).toHaveLength(
        0,
      );
    });

    it('rejects min_distance below 0', async () => {
      const errors = await checkFilter({ min_distance: -1 });
      expect(errorProps(errors)).toContain('min_distance');
    });

    it('rejects non-numeric min_distance', async () => {
      const errors = await checkFilter({ min_distance: 'not-a-number' });
      expect(errorProps(errors)).toContain('min_distance');
    });
  });

  // max_distance
  describe('max_distance', () => {
    it('accepts any non-negative number', async () => {
      const errors = await checkFilter({ max_distance: 100 });
      expect(errors.filter((e) => e.property === 'max_distance')).toHaveLength(
        0,
      );
    });

    it('accepts max_distance as a string — @Type converts it', async () => {
      const errors = await checkFilter({ max_distance: '50' });
      expect(errors.filter((e) => e.property === 'max_distance')).toHaveLength(
        0,
      );
    });

    it('rejects non-numeric max_distance', async () => {
      const errors = await checkFilter({ max_distance: 'far' });
      expect(errorProps(errors)).toContain('max_distance');
    });
  });

  // Inherits pagination constraints from PaginationDto
  describe('inherited PaginationDto constraints', () => {
    it('rejects limit > 500', async () => {
      const errors = await checkFilter({ limit: 501 });
      expect(errorProps(errors)).toContain('limit');
    });

    it('rejects page < 1', async () => {
      const errors = await checkFilter({ page: 0 });
      expect(errorProps(errors)).toContain('page');
    });
  });
});

// ---------------------------------------------------------------------------
// NearbyQueryDto
// ---------------------------------------------------------------------------
describe('NearbyQueryDto', () => {
  it('accepts valid lat, lng, and radius_km', async () => {
    const errors = await checkNearby({ lat: 41.69, lng: 44.83, radius_km: 25 });
    expect(errors).toHaveLength(0);
  });

  it('accepts lat + lng without radius_km (optional with default)', async () => {
    const errors = await checkNearby({ lat: 41.69, lng: 44.83 });
    expect(errors).toHaveLength(0);
  });

  // lat
  describe('lat', () => {
    it('rejects when lat is missing', async () => {
      const errors = await checkNearby({ lng: 44.83 });
      expect(errorProps(errors)).toContain('lat');
    });

    it('rejects a non-numeric lat', async () => {
      const errors = await checkNearby({ lat: 'north', lng: 44.83 });
      expect(errorProps(errors)).toContain('lat');
    });

    it('accepts lat as a string — @Type converts it', async () => {
      const errors = await checkNearby({ lat: '41.69', lng: 44.83 });
      expect(errors.filter((e) => e.property === 'lat')).toHaveLength(0);
    });

    it('accepts negative lat (southern hemisphere)', async () => {
      const errors = await checkNearby({ lat: -33.8, lng: 151.2 });
      expect(errors.filter((e) => e.property === 'lat')).toHaveLength(0);
    });
  });

  // lng
  describe('lng', () => {
    it('rejects when lng is missing', async () => {
      const errors = await checkNearby({ lat: 41.69 });
      expect(errorProps(errors)).toContain('lng');
    });

    it('rejects a non-numeric lng', async () => {
      const errors = await checkNearby({ lat: 41.69, lng: 'west' });
      expect(errorProps(errors)).toContain('lng');
    });

    it('accepts lng as a string — @Type converts it', async () => {
      const errors = await checkNearby({ lat: 41.69, lng: '44.83' });
      expect(errors.filter((e) => e.property === 'lng')).toHaveLength(0);
    });
  });

  // radius_km
  describe('radius_km', () => {
    it('accepts radius_km = 1 (minimum)', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: 1,
      });
      expect(errors.filter((e) => e.property === 'radius_km')).toHaveLength(0);
    });

    it('accepts radius_km = 50 (default)', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: 50,
      });
      expect(errors.filter((e) => e.property === 'radius_km')).toHaveLength(0);
    });

    it('accepts radius_km as a string — @Type converts it', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: '15',
      });
      expect(errors.filter((e) => e.property === 'radius_km')).toHaveLength(0);
    });

    it('rejects radius_km = 0 (below @Min(1))', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: 0,
      });
      expect(errorProps(errors)).toContain('radius_km');
    });

    it('rejects negative radius_km', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: -5,
      });
      expect(errorProps(errors)).toContain('radius_km');
    });

    it('rejects non-numeric radius_km', async () => {
      const errors = await checkNearby({
        lat: 41.69,
        lng: 44.83,
        radius_km: 'far',
      });
      expect(errorProps(errors)).toContain('radius_km');
    });
  });

  // Both lat and lng missing
  describe('missing required fields', () => {
    it('reports errors for both lat and lng when both are missing', async () => {
      const errors = await checkNearby({});
      const props = errorProps(errors);
      expect(props).toContain('lat');
      expect(props).toContain('lng');
    });
  });
});
