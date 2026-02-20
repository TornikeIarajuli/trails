import api from './api';
import { Product } from '../types/product';

export const shopService = {
  async getProducts(): Promise<Product[]> {
    const response = await api.get('/shop');
    return response.data;
  },

  async getProduct(id: string): Promise<Product> {
    const response = await api.get(`/shop/${id}`);
    return response.data;
  },
};
