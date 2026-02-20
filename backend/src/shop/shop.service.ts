import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ShopService {
  constructor(private supabaseService: SupabaseService) {}

  async findAll() {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('products')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Product not found');
    }

    return data;
  }

  async create(dto: CreateProductDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('products')
      .insert({
        name: dto.name,
        description: dto.description,
        image_url: dto.image_url,
        price: dto.price,
        shop_name: dto.shop_name,
        external_url: dto.external_url,
        is_published: dto.is_published ?? false,
        sort_order: dto.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateProductDto) {
    const admin = this.supabaseService.getAdminClient();

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'description', 'image_url', 'price',
      'shop_name', 'external_url', 'is_published', 'sort_order',
    ];

    for (const field of fields) {
      if ((dto as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (dto as Record<string, unknown>)[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new NotFoundException('No valid fields to update');
    }

    const { data, error } = await admin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Product not found');

    return data;
  }

  async remove(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin.from('products').delete().eq('id', id);

    if (error) throw error;

    return { message: 'Product deleted successfully' };
  }
}
