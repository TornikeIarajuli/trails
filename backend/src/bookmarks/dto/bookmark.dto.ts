import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const BOOKMARK_CATEGORIES = [
  'saved',
  'want_to_hike',
  'in_progress',
  'favorites',
] as const;

export type BookmarkCategory = (typeof BOOKMARK_CATEGORIES)[number];

export class ToggleBookmarkDto {
  @IsOptional()
  @IsIn(BOOKMARK_CATEGORIES)
  category?: BookmarkCategory;
}

export class UpdateBookmarkDto {
  @IsOptional()
  @IsIn(BOOKMARK_CATEGORIES)
  category?: BookmarkCategory;

  /** `null` clears the note. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class BookmarksQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(BOOKMARK_CATEGORIES)
  category?: BookmarkCategory;
}
