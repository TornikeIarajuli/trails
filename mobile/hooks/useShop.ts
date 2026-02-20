import { useQuery } from '@tanstack/react-query';
import { shopService } from '../services/shop';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => shopService.getProducts(),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => shopService.getProduct(id),
    enabled: !!id,
  });
}
